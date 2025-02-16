async function scheduleHtmlProvider() {
  await loadTool('AIScheduleTools'); // 加载工具集

  // 提取 Admin-Token 的函数
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? parts.pop().split(';').shift() : null;
  }

  // 获取 Admin-Token
  const xToken = getCookie('Admin-Token');
  if (!xToken) {
    throw new Error('未能获取 Admin-Token，请确保已登录');
  }

  try {
    // 获取学年
    const year = await AISchedulePrompt({
      titleText: '学年',
      tipText: '请输入本学年开始的年份',
      defaultText: '2024',
      validator: value => {
        try {
          const v = parseInt(value, 10);
          if (isNaN(v) || v < 2000 || v > 2100) {
            return '请输入正确的学年（例如：2024）';
          }
          return false;
        } catch (error) {
          return '请输入正确的学年';
        }
      },
    });

    // 获取学期
    const term = await AISchedulePrompt({
      titleText: '学期',
      tipText: '请输入本学期的学期(1 表示上学期，2 表示下学期)',
      defaultText: '1',
      validator: value => {
        if (value !== '1' && value !== '2') {
          return '请输入正确的学期（1 或 2）';
        }
        return false;
      },
    });

    // 获取学号
    const id = await AISchedulePrompt({
      titleText: '学号',
      tipText: '请输入你的学号',
      defaultText: '',
      validator: value => {
        try {
          const v = parseInt(value, 10);
          if (isNaN(v)) {
            return '请输入正确的学号（必须为数字）';
          }
          return false;
        } catch (error) {
          return '请输入正确的学号';
        }
      },
    });

    // 构造请求负载
    const payload = {
      weekNum: "", // 如果需要动态获取周数，可以在这里添加逻辑
      yearTermId: `${year}${term}`, // 学年学期组合，例如：20241 表示 2024-2025 上学期
      studId: id, // 学号
    };

    // 发送请求
    const url = 'https://neweas.wvpn.huat.edu.cn/api/teachTask/list';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-token': xToken, // 添加 Admin-Token 到请求头
      },
      body: JSON.stringify(payload),
      credentials: 'include', // 确保携带当前页面的 Cookie
    });

    if (!response.ok) {
      throw new Error(`请求失败，状态码：${response.status}`);
    }

    const data = await response.json();
    return JSON.stringify(data); // 返回 JSON 字符串
  } catch (error) {
    console.error(error.message);
    await AIScheduleAlert(error.message); // 提示用户错误信息
    return 'do not continue'; // 停止后续操作
  }
}