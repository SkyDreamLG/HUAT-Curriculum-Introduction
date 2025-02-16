// 本JS用于转发iframe中的请求
window.addEventListener('message', ({ data }) => {
  // 过滤脚本来源
  console.log('devpanel transfer script get message: ', data)
  // devpanel -> content 开启测试
  if (data?.to === 'content') {
    chrome.tabs.sendMessage(
      chrome.devtools.inspectedWindow.tabId,
      data,
      () => {}
    )
    return true
  }
  // devpanel -> transit 请求环境，或者发送请求
  if (data?.to === 'transit') {
    if (data.cmd === 'version') {
      // 获取本地插件版本
      const manifest = chrome.runtime.getManifest()
      const res = {
        from: 'transit',
        to: 'devpanel',
        cmd: 'version',
        params: {
          version: manifest.version
        }
      }
      document.getElementById('devpanel').contentWindow.postMessage(res, '*')
    }
  }
  // devpanel -> background 登录登出操作
  if (data?.to === 'background') {
    // 获取到结果之后需要返回给网页
    const { cmd } = data
    chrome.runtime.sendMessage(data, ({ ok, data, message }) => {
      const res = {
        from: 'background',
        to: 'devpanel',
        cmd,
        params: {
          ok,
          data,
          message
        }
      }
      document.getElementById('devpanel').contentWindow.postMessage(res, '*')
    })
  }
  return undefined
})
