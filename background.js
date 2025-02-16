/**
 * 事件监听器
 */
const messageListener = (message, _, sendResponse) => {
  // 也可以收到从内容脚本发送的消息，需要过滤一下
  console.log('background script get message: ', message)
  if (message?.to !== 'background') return undefined

  // 背景函数在此插件只负责登录操作
  const { cmd } = message

  /**
   * 封装处理cookie
   * @param {*} type 类型
   */
  const cookieHandler = async type => {
    if (type === 'get') {
      chrome.cookies.get({ url: 'https://open-schedule-prod.ai.xiaomi.com/', name: 'userId' }, cookieInfo => {
        if (cookieInfo === null) { return sendResponse({
          ok: false,
          data: null,
          message: '无用户信息，请重新登录'
        }) }
        return sendResponse({
          ok: true,
          data: cookieInfo.value,
          message: ''
        })
      })
    }
    if (type === 'del') {
      await chrome.cookies.getAll({ url: 'https://open-schedule-prod.ai.xiaomi.com/' }, cookieList => {
        for (const cookie of cookieList) {
          chrome.cookies.remove({ url: 'https://open-schedule-prod.ai.xiaomi.com/', name: cookie.name })
        }
        return sendResponse({
          ok: true,
          data: null,
          message: ''
        })
      })
    }
  }

  // 处理指令
  switch (cmd) {
    case 'login':
      // 登录操作，返回userId
      cookieHandler('get')
      break
    case 'logout':
      // 登出操作，清空用户数据
      cookieHandler('del')
      break
    default:
      sendResponse({
        ok: true,
        data: null,
        message: ''
      })
  }

  // 如需异步调用sendResponse则返回true
  return true
}

chrome.runtime.onMessage.addListener(messageListener)
