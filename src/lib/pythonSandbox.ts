// Python 沙箱执行工具（基于 Pyodide）
// 设计目标：
// - 在浏览器中执行 Python 代码
// - 自动解析并安装依赖（优先加载 Pyodide 内置包，失败时使用 micropip 安装纯 Python 包）
// - 通过回调上报安装与执行阶段的进度与提示信息
//
// 重要说明：
// - 仅支持纯 Python 或 Pyodide 提供的预编译包
// - 含原生扩展的库可能无法安装；将通过回调给出失败提示
//
// 使用示例：
// const result = await runPython(code, stdin, (p) => { console.log(p.stage, p.message, p.percent) })
// console.log(result.stdout, result.stderr)

export type PyStage = 'init' | 'load' | 'install' | 'run' | 'done' | 'error'

export interface PyProgress {
  stage: PyStage
  message?: string
  percent?: number
  pkg?: string
}

let pyodideInstance: any | null = null

// 加载并初始化 Pyodide 单例
async function ensurePyodide(onProgress?: (p: PyProgress) => void) {
  if (pyodideInstance) return pyodideInstance
  try {
    onProgress?.({ stage: 'init', message: '初始化 Pyodide...' })
    // 动态注入脚本，使用 full 分发路径保证资源可用
    const scriptUrl = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js'
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = scriptUrl
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Pyodide 脚本加载失败'))
      document.head.appendChild(s)
    })
    const loader = (window as any).loadPyodide
    if (!loader) throw new Error('Pyodide 未初始化')
    onProgress?.({ stage: 'load', message: '加载运行时...' })
    pyodideInstance = await loader({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/' })
    onProgress?.({ stage: 'load', message: '加载 micropip...', percent: 20 })
    await pyodideInstance.loadPackage('micropip')
    onProgress?.({ stage: 'load', message: 'Pyodide 就绪', percent: 30 })
    return pyodideInstance
  } catch (e: any) {
    onProgress?.({ stage: 'error', message: e?.message || String(e) })
    throw e
  }
}

// 解析 import/from 语句，返回可能需要安装的模块集合
function parseImports(code: string): string[] {
  const groups = [
    /(?:^|\n)\s*import\s+([a-zA-Z0-9_]+)/g,
    /(?:^|\n)\s*from\s+([a-zA-Z0-9_.]+)\s+import\s+[a-zA-Z0-9_*,\s]+/g,
  ]
  const found = new Set<string>()
  for (const re of groups) {
    let m: RegExpExecArray | null
    while ((m = re.exec(code)) !== null) {
      const mod = (m[1] || '').split('.')[0]
      if (mod) found.add(mod)
    }
  }
  // 常见内置/标准库跳过
  const skip = new Set([
    'sys','os','math','json','re','time','random','datetime','itertools','functools','collections',
    'statistics','typing','pathlib','subprocess','http','urllib','unittest','inspect','micropip','pyodide'
  ])
  return Array.from(found).filter(x => !skip.has(x))
}

// 常见包名映射（Import Name -> Package Name）
const PACKAGE_MAPPINGS: Record<string, string> = {
  'sklearn': 'scikit-learn',
  'cv2': 'opencv-python',
  'PIL': 'Pillow',
  'yaml': 'pyyaml',
  'bs4': 'beautifulsoup4',
  'dateutil': 'python-dateutil',
  'dotenv': 'python-dotenv',
  'socketio': 'python-socketio',
}

// 安装依赖：优先 loadPackagesFromImports，然后尝试 micropip.install
async function installDependencies(py: any, code: string, pkgs: string[], onProgress?: (p: PyProgress) => void) {
  // 1. 尝试让 Pyodide 自动加载内置包（如 scikit-learn, numpy, pandas 等）
  try {
    onProgress?.({ stage: 'install', message: '检测并加载内置包...', percent: 25 })
    await py.loadPackagesFromImports(code)
  } catch (e) {
    console.warn('loadPackagesFromImports failed:', e)
  }

  if (!pkgs.length) return

  let done = 0
  const total = pkgs.length
  
  for (const rawPkg of pkgs) {
    const pkg = PACKAGE_MAPPINGS[rawPkg] || rawPkg
    
    // 如果已经加载了，跳过（简单检查）
    // 注意：这里没有完美的检查方法，依赖 loadPackagesFromImports 已尽力
    
    try {
      onProgress?.({ stage: 'install', message: `检查/安装包：${pkg}`, percent: 30 + Math.floor((done / total) * 50), pkg })
      
      // 尝试加载（如果是 Pyodide 内置包，loadPackage 会很快）
      await py.loadPackage(pkg)
    } catch {
      try {
        // 如果 loadPackage 失败，尝试用 micropip 从 PyPI 安装
        onProgress?.({ stage: 'install', message: `从 PyPI 安装：${pkg}`, percent: 30 + Math.floor((done / total) * 50), pkg })
        await py.runPythonAsync(`import micropip; await micropip.install(${JSON.stringify(pkg)})`)
      } catch (e: any) {
        // 忽略错误，可能是已经安装或无法安装，交由运行时报错
        console.warn(`安装失败: ${pkg}`, e)
        // onProgress?.({ stage: 'install', message: `安装失败（跳过）：${pkg}`, pkg })
      }
    } finally {
      done += 1
      onProgress?.({ stage: 'install', percent: 30 + Math.floor((done / total) * 50) })
    }
  }
}

export async function runPython(code: string, stdin = '', onProgress?: (p: PyProgress) => void): Promise<{ stdout: string; stderr: string }> {
  const py = await ensurePyodide(onProgress)
  
  // 解析并安装依赖
  const pkgs = parseImports(code || '')
  await installDependencies(py, code, pkgs, onProgress)

  // 执行代码并捕获输出
  onProgress?.({ stage: 'run', message: '执行代码...', percent: 85 })
  const wrapper = `
import sys, io, json, traceback
_stdout = io.StringIO()
_stderr = io.StringIO()
sys.stdout = _stdout
sys.stderr = _stderr
stdin_data = ${JSON.stringify(stdin || '')}
sys.stdin = io.StringIO(stdin_data)
code = ${JSON.stringify(code || '')}
result_json = "{}"
try:
    exec(code, {})
except Exception:
    traceback.print_exc()
finally:
    # 恢复标准流（可选，但在沙箱环境中通常不需要）
    pass

try:
    result_data = {
        "stdout": _stdout.getvalue(),
        "stderr": _stderr.getvalue()
    }
    result_json = json.dumps(result_data)
except Exception:
    # 兜底：如果 JSON 序列化失败
    result_json = json.dumps({"stdout": "", "stderr": "Error serializing output"})

result_json
`
  try {
    const jsonStr = await py.runPythonAsync(wrapper)
    const result = JSON.parse(jsonStr)
    onProgress?.({ stage: 'done', message: '完成', percent: 100 })
    return { stdout: String(result.stdout || ''), stderr: String(result.stderr || '') }
  } catch (e: any) {
    onProgress?.({ stage: 'error', message: e?.message || String(e) })
    return { stdout: '', stderr: e?.message || String(e) }
  }
}
