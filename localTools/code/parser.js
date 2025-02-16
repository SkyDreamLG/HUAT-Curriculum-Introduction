function truncateStringByBytes(str, maxLength = 50) {
  if (!str) return '';
  let length = 0;
  let result = '';
  for (const char of str) {
    length += char.length > 1 ? 2 : 1; // 汉字占 2 字节
    if (length > maxLength) break;
    result += char;
  }
  return result;
}

function scheduleHtmlParser(html) {
  const data = JSON.parse(html).data; // 解析JSON数据
  const result = [];

  for (const item of data) {
    const course = {
      name: truncateStringByBytes(item.courName), // 截取前50字节
      position: truncateStringByBytes(`${item.schoolAddr} ${item.roomId}`), // 截取前50字节
      teacher: (item.teacherList && item.teacherList.length > 0 && item.teacherList[0].teacherName) || '未知教师', // 默认值
      weeks: Array.isArray(item.weekSection) ? item.weekSection.split(',').map(Number) : Array.from({ length: item.weekEnd - item.weekBegin + 1 }, (_, i) => item.weekBegin + i), // 支持非连续周数
      day: item.weekDay,
      sections: Array.isArray(item.startSection) ? item.startSection.split(',').map(Number) : Array.from({ length: item.endSection - item.startSection + 1 }, (_, i) => item.startSection + i), // 支持非连续节次
    };
    result.push(course);
  }

  return result;
}