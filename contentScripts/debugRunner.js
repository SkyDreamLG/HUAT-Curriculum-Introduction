var cheerio = require('cheerio')

// 拓展isArray
if (!Array.isArray) {
  Array.isArray = function (arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
  };
}

/**
 * 蓝色输出
 * @param {String} message 消息内容
 */
const consoleBlue = message => {
  console.log(
    `%c AISchedule %c ${message} %c`,
    'background:#222831 ; padding: 4px; border-radius: 3px 0 0 3px;  color: #fff',
    'padding: 3px; border-radius: 0 3px 3px 0; color: #409eff; border: 1px solid #d9ecff; background-color: #ecf5ff;',
    'background:transparent'
  )
}

/**
 * 橙色输出
 * @param {String} message 消息内容
 */
const consoleOrange = message => {
  console.log(
    `%c AISchedule %c ${message} %c`,
    'background:#222831 ; padding: 3px; border-radius: 3px 0 0 3px;  color: #fff',
    'padding: 3px; border-radius: 0 3px 3px 0; color: #e6a23c; border: 1px solid #faecd8; background-color: #fdf6ec;',
    'background:transparent'
  )
}

/**
 * 红色输出
 * @param {String} message 消息内容
 */
const consoleRed = message => {
  console.log(
    `%c AISchedule %c ${message} %c`,
    'background:#222831 ; padding: 3px; border-radius: 3px 0 0 3px;  color: #fff',
    'padding: 3px; border-radius: 0 3px 3px 0; color: #f56c6c; border: 1px solid #fde2e2; background-color: #fef0f0;',
    'background:transparent'
  )
}

/**
 * 绿色输出
 * @param {String} message 消息内容
 */
const consoleGreen = message => {
  console.log(
    `%c AISchedule %c ${message} %c`,
    'background:#222831 ; padding: 3px; border-radius: 3px 0 0 3px;  color: #fff',
    'padding: 3px; border-radius: 0 3px 3px 0; color: #67c23a; border: 1px solid #e1f3d8; background-color: #f0f9eb;',
    'background:transparent'
  )
}

const courseProps = ['name', 'teacher', 'position', 'day', 'weeks', 'sections']

/**
 * 根据错误属性以及原因创建上报错误码
 * @param {*} attribute 错误的属性index
 * @param {*} code 错误原因码
 * @returns {String}
 */
const makeErrorCode = (attribute, code) => {
  attribute = Number(attribute) + 1
  const tail = code < 10 ? `0${code}` : `${code}`
  return Number(`${attribute}${tail}`)
}

const getStrLengthCode = length => {
  if (length <= 55) return 2
  if (length <= 60) return 3
  if (length <= 70) return 4
  if (length <= 80) return 5
  return 6
}

/**
 * 判断参数是否为 undefined 或 null
 * @param  {any[]} args
 */
const exist = (...args) => {
  const errList = []
  const canUse = args.every((value, index) => {
    if ((value !== undefined && value !== null)
      && (JSON.stringify(value) !== '{}')
      && (JSON.stringify(value) !== '[]')
    ) return true
    errList.push(index)
    return false
  }) && args.length !== 0
  return { canUse, errList }
}

/**
 * 容错处理字符串
 * @param {String} name 字符串所属属性名
 * @param {String} str 待处理字符串
 * @param {Number} len 字符串允许最大长度，单位：字节
 * @param {Boolean} canCut 是否可以自动裁剪
 */
const failoverString = (name, str, len = 50, canCut = true) => {
  const isString = typeof str === 'string'
  if (!isString) {
    console.error(`${name}: 应为 String 类型`)
    return {
      canUse: false,
      hasCut: false,
      errCode: 1,
      content: '',
    }
  }
  const strLength = str.replace(/[^\x00-\xff]/g, '**').length
  const inRange = strLength <= len
  const errCode = getStrLengthCode(strLength)
  if (!inRange) {
    if (!canCut) {
      console.error(`${name}: 字符串长度应小于等于${len}字节, 当前为: ${str}`)
      return {
        canUse: false,
        hasCut: false,
        errCode,
        content: '',
      }
    }

    while (str.replace(/[^\x00-\xff]/g, '**').length > len) {
      str = str.slice(0, -1)
    }
    console.error(`${name}: 字符串长度应小于等于${len}字节, 已裁剪为: ${str}`)
  }
  return {
    canUse: true,
    hasCut: !inRange,
    errCode,
    content: str,
  }
}


/**
 * 容错处理数组
 * @param {String} name 数组所属属性名
 * @param {String} arr 待处理数组
 * @param {Boolean} canEmpty 是否允许数组为空
 * @param {Function} elementCondition 对数组内元素的容错方法
 */
const failoverArray = (name, arr, canEmpty = false, elementCondition = () => { }) => {
  if (!Array.isArray(arr)) {
    console.error(`${name}: 应为Array类型`)
    return {
      canUse: false,
      errCode: 4,
      content: [],
    }
  }
  if (!canEmpty && arr.length === 0) {
    console.error(`${name}: 内容不能为空`)
    return {
      canUse: false,
      errCode: 5,
      content: [],
    }
  }
  const content = []
  const canUse = arr.every(ele => {
    const newEle = elementCondition(name, ele)
    content.push(newEle)
    return newEle
  })
  return {
    canUse,
    errCode: 0, // 占位用，需要判断是否是4或者5
    content,
  }
}

/**
 * 容错处理数字
 * @param {String} name 数字所属属性名
 * @param {Number} num 待处理数字
 * @param {Number[]} range 数字所处的范围闭区间
 * @param {Boolean} isInt 是否要求为整数
 */
const failoverNumber = (name, num, range = [0, 1], isInt = true) => {
  num = Number(num)
  const hasLeft = range[0] !== undefined
  const hasRight = range[1] !== undefined
  if (typeof num !== 'number' || isNaN(num)) {
    console.error(`${name}: 应为可转换为Number类型的数字, 当前为: ${num}`)
    return {
      canUse: false,
      errCode: 1,
      content: 0,
    }
  }
  const int = (isInt && num.toString().indexOf('.') === -1) || !isInt
  const min = (hasLeft && num >= range[0]) || range[0] === undefined
  const max = (hasRight && num <= range[1]) || range[1] === undefined
  if (!int) {
    console.error(`${name}: 应为整数, 当前为: ${num}`)
    return {
      canUse: false,
      errCode: 2,
      content: 0,
    }
  }
  if (!(min && max)) {
    console.error(`${name}: 应为 [${hasLeft ? range[0] : '∞'}, ${hasRight ? range[1] : '∞'}] 范围内的数字, 当前为: ${num}`)
    return {
      canUse: false,
      errCode: 3,
      content: 0,
    }
  }
  return {
    canUse: true,
    content: num,
    errCode: 0,
  }
}

/**
 * 容错处理一节课程
 * @param {Object} course 需要处理的课程
 */
const validateCourse = course => {
  const errCodeList = []
  const values = courseProps.map(key => course[key])
  const existRes = exist(...values)
  if (!existRes.canUse) {
    existRes.errList.forEach(index => {
      console.error(`${courseProps[index]} 不存在或值为空`)
      errCodeList.push(makeErrorCode(index, 0))
    })
    return {
      canUse: false,
      errCodeList,
      maxWeek: 0,
      isWeekend: 0,
      content: {},
    }
  }
  const content = {}
  const canUse = values.every((value, index) => {
    const key = courseProps[index]
    if (key === 'name') {
      if (!value) {
        console.error('name: 不能为空')
        errCodeList.push(makeErrorCode(index, 0))
        return false
      }
      const valiRes = failoverString(key, value)
      content[key] = valiRes.content
      // 如果超长且无extend属性
      valiRes.hasCut && !course?.extend ? content.extend = value : null
      // 如果有错误保存错误码
      if (!valiRes.canUse || valiRes.hasCut) errCodeList.push(makeErrorCode(index, valiRes.errCode))
      return valiRes.canUse
    }
    if (key === 'teacher' || key === 'position') {
      const valiRes = failoverString(key, value)
      content[key] = valiRes.content
      // 如果有错误保存错误码
      if (!valiRes.canUse || valiRes.hasCut) errCodeList.push(makeErrorCode(index, valiRes.errCode))
      return valiRes.canUse
    }
    if (key === 'day') {
      const valiRes = failoverNumber(key, value, [1, 7], true)
      if (!valiRes.canUse) errCodeList.push(makeErrorCode(index, valiRes.errCode))
      content[key] = valiRes.content
      return valiRes.canUse
    }
    if (key === 'weeks') {
      const valiRes = failoverArray(key, value, false, (key, value) => {
        const valiRes = failoverNumber(`${key} -> week`, value, [1, undefined], true)
        if (!valiRes.canUse) {
          // week有错误上报错误
          errCodeList.push(makeErrorCode(index, valiRes.errCode))
          return false
        }
        return valiRes.content
      })
      if (valiRes.canUse) {
        // 对周数进行过滤以及去重处理
        content[key] = [...new Set(valiRes.content)].filter(week => week <= 30)
      }
      // 整个数组有问题上报数组
      if (!valiRes.canUse && valiRes.errCode) errCodeList.push(makeErrorCode(index, valiRes.errCode))
      return valiRes.canUse
    }
    if (key === 'sections') {
      // 新旧系统统一改造成[1, 2, 3]的形式
      const valiRes = failoverArray(key, value, false, (key, value) => {
        // 自适应新旧版参数
        const valiVal = value?.section || value
        // 允许课程从第0节开始，后续处理如果有从0开始的会将所有课程节数+1
        const valiRes = failoverNumber(`${key} -> section`, valiVal, [0, undefined], true)
        if (!valiRes.canUse) {
          errCodeList.push(makeErrorCode(index, valiRes.errCode))
          return false
        }
        return valiRes.content
      })
      content[key] = valiRes.content
      // 整个数组有问题上报数组
      if (!valiRes.canUse && valiRes.errCode) errCodeList.push(makeErrorCode(index, valiRes.errCode))
      return valiRes.canUse
    }
    return true
  })
  if (!canUse) {
    return {
      canUse: false,
      errCodeList,
      maxWeek: 0,
      isWeekend: 0,
      content: {},
    }
  }
  // 追加不判断属性extend
  course?.extend && !content?.extend ? content.extend = course.extend : null
  // 判断最大周数，最后应用到设置里，最大三十周，超出会被过滤掉
  // 但是要打印出来告诉开发者
  const maxWeek = Math.max(...content.weeks)
  return {
    canUse,
    errCodeList,
    maxWeek,
    isWeekend: content.day > 5 ? 1 : 0,
    content,
  }
}

/**
 * 容错处理所有课程, 并根据课程获取总周数
 * 同时进行了参数的过滤, 只保留courseProps中属性以及extend
 * @param {Object} courseInfos 需要处理的课程
 */
const validateCourseInfos = courseInfos => {
  const errCourses = []
  const newCourses = []
  const errCodeList = []
  let totalWeek = 20
  let isWeekend = 0
  console.info('本次导入的课程信息为: ', courseInfos)
  console.info('Tips: 字符串长度按字节计算，中文1字符相当于2字节')
  console.info('Tips: 最大周数限定为30周，超出部分会被自动过滤掉')
  courseInfos.forEach((rawCourse, index) => {
    // 没有teacher和position属性自动补全
    Object.prototype.hasOwnProperty.call(rawCourse, 'teacher') ? null : errCodeList.push(200)
    Object.prototype.hasOwnProperty.call(rawCourse, 'position') ? null : errCodeList.push(300)
    const course = { teacher: '', position: '', ...rawCourse }
    console.info(`开始验证第 ${index + 1} 节课程`)
    const valiRes = validateCourse(course)
    errCodeList.push(...valiRes.errCodeList)
    if (valiRes.canUse) {
      console.info('验证通过')
      // 获取课程的最大值
      if (valiRes.maxWeek > totalWeek) totalWeek = valiRes.maxWeek
      // 判断是否是周末课程
      if (valiRes.isWeekend) isWeekend = 1
      return newCourses.push(valiRes.content)
    }
    console.error('验证不通过')
    return errCourses.push(course)
  })
  if (errCourses.length) {
    console.error('本次验证不通过的课程有：', errCourses)
    console.error('以上课程将不会加入本次导入')
  }
  if (!newCourses.length) {
    console.error('验证后无可导入课程，导入失败')
    return {
      canUse: false,
      hasCut: false,
      errCodeList,
      totalWeek: 20,
      isWeekend: 0,
      content: [],
    }
  }
  return {
    canUse: true,
    hasCut: !!errCourses.length,
    errCodeList,
    totalWeek,
    isWeekend,
    content: newCourses,
  }
}

/**
 * 将时间转化为数字
 * @param {String} time 需要转化的时间，例：05:11
 */
const timeStr2Num = time => {
  const hour = Number(time.split(':')[0])
  const minute = Number(time.split(':')[1])
  return hour * 60 + minute
}

/**
 * 容错处理课程时间
 * @param {Object} sectionTimes 需要处理的课程时间
 */
const validateSectionTimes = sectionTimes => {
  console.info('本次导入的原始时间信息为:', sectionTimes)
  // 对时间格式内容进行校验
  const valiRes = failoverArray('sectionTimes', sectionTimes, false, (key, value) => {
    const newSection = {}
    const sectionRes = failoverNumber(`${key} -> section`, value?.section, [0, undefined], true)
    if (!sectionRes.canUse) return false
    newSection.section = sectionRes.content
    const startTimeRes = failoverString(`${key} -> startTime`, value?.startTime, 5)
    if (!startTimeRes.canUse) return false
    newSection.startTime = startTimeRes.content
    const endTimeRes = failoverString(`${key} -> endTime`, value?.endTime, 5)
    if (!endTimeRes.canUse) return false
    newSection.endTime = endTimeRes.content
    return newSection
  })
  if (!valiRes.canUse) {
    return {
      canUse: false,
      content: [],
      errCode: valiRes.errCode === 5 ? 700 : 701,
    }
  }
  // 对时间信息进行查重并且判断有结束时间早于开始时间
  const startSet = new Set()
  const stopSet = new Set()
  const repeatRes = sectionTimes.every(section => {
    if (startSet.has(section.startTime)) return false
    if (stopSet.has(section.endTime)) return false
    if (timeStr2Num(section.startTime) >= timeStr2Num(section.endTime)) return false
    startSet.add(section.startTime)
    stopSet.add(section.endTime)
    return true
  })
  if (!repeatRes) {
    console.error('sectionTimes: 存在重复时间课程或者有课程结束时间早于课程开始时间，请检查')
    return {
      canUse: false,
      content: [],
      errCode: 701,
    }
  }
  // 对时间信息进行排序
  sectionTimes.sort((s1, s2) => timeStr2Num(s1.startTime) - timeStr2Num(s2.startTime))
  sectionTimes.forEach((time, idx) => {
    time.section = idx + 1
  })
  console.info('排序后时间信息为:', sectionTimes)
  // 检测有无开始时间早于上节课结束时间
  const conflictRes = sectionTimes.every((section, idx, sectionTimes) => {
    if (idx === 0) return true
    const compare = timeStr2Num(section.startTime) >= timeStr2Num(sectionTimes[idx - 1].endTime)
    if (compare) return true
    console.error(`sectionTimes: 第 ${idx} 与 第 ${idx + 1}节课时间存在冲突`)
    return false
  })
  if (!conflictRes) {
    return {
      canUse: false,
      content: [],
      errCode: 702,
    }
  }
  let morningNum = 0
  let afternoonNum = 0
  let nightNum = 0
  // 按下午一点和下午六点分成三段节数
  const sections = sectionTimes.map(time => {
    const startTime = timeStr2Num(time.startTime)
    if (startTime < timeStr2Num('13:00')) morningNum += 1
    else if (startTime < timeStr2Num('18:00')) afternoonNum += 1
    else nightNum += 1
    return {
      i: time.section,
      s: time.startTime,
      e: time.endTime,
    }
  })
  return {
    canUse: true,
    content: {
      sections,
      morningNum,
      afternoonNum,
      nightNum,
    },
    errCode: 0,
  }
}

/**
 * 根据课程数量获取对应的错误码
 * @param {Number} length 课程数量
 * @returns {Number} 错误码
 */
const getCoursesLengthCode = length => {
  if (length <= 160) return 1000
  if (length <= 180) return 1001
  if (length <= 200) return 1002
  if (length <= 250) return 1003
  if (length <= 300) return 1004
  return 1005
}

/**
 * 根据非合并信息获取课程信息ID
 * @param {Object} course 一节课程的信息
 * @returns {String} 课程唯一标识
 */
const getCourseId = course => {
  const { name, teacher, position, day } = course
  return `${name}-${teacher}-${position}-${day}`
}

/**
 * 获取排序后的课程节次
 * @param {Object} course 一节课程的信息
 * @returns {Number[]} 排序后的课程节次
 */
const getCourseSection = course => {
  return course.sections.map(section => Number(section)).sort((a, b) => a - b)
}

/**
 * 获取数组中最后一个元素
 * @param {Array} arr 需要处理的数组
 * @returns {Any} 数组中最后一个元素
 */
const getArrLast = arr => {
  return arr[arr.length - 1]
}

/**
 * 通过节次合并课程
 * @param {Object} c1 课程一
 * @param {Object} c2 课程二
 * @returns
 */
const packCourseBySections = (c1, c2) => {
  // 周数不一致不能合并
  if (c1.weeks.join() !== c2.weeks.join()) return false
  const s1 = getCourseSection(c1)
  const s2 = getCourseSection(c2)
  // c2在c1之后
  if (s2[0] - getArrLast(s1) === 1) {
    return {
      ...c1,
      sections: Array.from(new Set(s1.concat(s2))),
    }
  }
  // c1在c2之后
  if (s1[0] - getArrLast(s2) === 1) {
    return {
      ...c1,
      sections: Array.from(new Set(s2.concat(s1))),
    }
  }
  // 两节课不连续
  return false
}

/**
 * 通过周数合并课程
 * @param {Object} c1 课程一
 * @param {Object} c2 课程二
 * @returns
 */
const packByCourseWeeks = (c1, c2) => {
  // 节数不一致不能合并
  if (getCourseSection(c1).join() !== getCourseSection(c2).join()) return false
  // 节数一致就除了周数之外都一致了,顺便去重
  return {
    ...c1,
    weeks: Array.from(new Set(c1.weeks.concat(c2.weeks))),
  }
}

/**
 * 弹出列表中第一个课程并和其他所有课程比对是否能够通过节次合并
 * @param {Object[]} courses 课程列表
 * @returns
 */
const packSameCoursesBySections = courses => {
  const sameCourses = [...courses]
  let needPackOne = sameCourses.shift()
  let canPackBySections = true
  const packBySections = () => sameCourses.some((course, idx) => {
    const packRes = packCourseBySections(needPackOne, course)
    if (packRes) {
      needPackOne = packRes
      sameCourses.splice(idx, 1)
      return true
    }
    return false
  })
  while (canPackBySections === true) {
    canPackBySections = packBySections()
  }
  return {
    newCourse: needPackOne,
    newSameCourses: sameCourses,
  }
}

/**
 * 弹出列表中第一个课程并和其他所有课程比对是否能够通过周数合并
 * @param {Object[]} courses 课程列表
 * @returns
 */
const packSameCoursesByWeeks = courses => {
  const sameCourses = [...courses]
  let needPackOne = sameCourses.shift()
  let canPackByWeeks = true
  const packByWeeks = () => sameCourses.some((course, idx) => {
    const packRes = packByCourseWeeks(needPackOne, course)
    if (packRes) {
      needPackOne = packRes
      sameCourses.splice(idx, 1)
      return true
    }
    return false
  })
  while (canPackByWeeks === true) {
    canPackByWeeks = packByWeeks()
  }
  return {
    newCourse: needPackOne,
    newSameCourses: sameCourses,
  }
}

/**
 * 合并课程列表
 * @param {Object[]} courseInfos 所有课程信息
 * @returns
 */
const packCourseInfos = courseInfos => {
  console.info('开始进行课程合并，合并前课程信息为: ', courseInfos, '长度为：', courseInfos.length)
  const collect = new Map()
  const courseList = []
  // 将不可合并的部分编成字符串作为id进行分类
  courseInfos.map(course => {
    const id = getCourseId(course)
    if (!collect.has(id)) return collect.set(id, [course])
    const old = collect.get(id)
    old.push(course)
    return collect.set(id, old)
  })
  // 将分类完成的课程进行合并
  collect.forEach(value => {
    // 如无可合并课程直接放进结果列表
    if (value.length === 1) return courseList.push(value[0])
    let sameCourses = [...value]
    let afterPackBySections = []
    // 先按节数合并所有的课程
    while (sameCourses.length !== 0) {
      const { newCourse, newSameCourses } = packSameCoursesBySections(sameCourses)
      afterPackBySections.push(newCourse)
      sameCourses = newSameCourses
    }
    // 将按节数合并完的课程按周数合并
    while (afterPackBySections.length !== 0) {
      const { newCourse, newSameCourses } = packSameCoursesByWeeks(afterPackBySections)
      courseList.push(newCourse)
      afterPackBySections = newSameCourses
    }
    return false
  })
  const courseLength = courseList.length
  console.info('已完成课程合并，合并后课程信息为: ', courseList, '长度为：', courseLength)
  let errCode = 0
  if (courseLength > 150) {
    console.info(`合并后课程数量不应大于150，当前为：${courseList.length}，导入失败`)
    errCode = getCoursesLengthCode(courseList.length)
  }
  return {
    canUse: !errCode,
    content: courseList,
    errCode,
  }
}

/**
 * 校验时间设置
 * @param {Object} timer 时间设置
 * @returns
 */
const verifyAndTranslateTimer = timer => {
  if (!timer || Object.keys(timer).length === 0) return {}
  const tableSetting = {}
  // 总周数
  const totalWeekRes = failoverNumber('totalWeek', timer.totalWeek, [1, 30], true)
  if (totalWeekRes.canUse) tableSetting.totalWeek = totalWeekRes.content
  // 开学时间
  const startSemesterRes = failoverString('startSemester', timer.startSemester, 13, false)
  if (startSemesterRes.canUse) tableSetting.startSemester = startSemesterRes.content
  // 是否是周日为起始日
  if (timer.startWithSunday && typeof timer.startWithSunday === 'boolean') {
    tableSetting.weekStart = timer.startWithSunday ? 7 : 1
  }
  // 是否显示周末
  if (timer.showWeekend && typeof timer.showWeekend === 'boolean') {
    tableSetting.isWeekend = timer.showWeekend ? 1 : 0
  }
  // 课程时间信息
  const forenoonRes = failoverNumber('forenoon', timer.forenoon, [1, 10], true)
  const afternoonRes = failoverNumber('afternoon', timer.afternoon, [0, 10], true)
  const nightRes = failoverNumber('night', timer.night, [0, 10], true)
  const sectionRes = validateSectionTimes(timer.sections)
  // 只有在全部内容都可用的前提下才使用
  if (forenoonRes.canUse && afternoonRes.canUse && nightRes.canUse && sectionRes.canUse) {
    // 只有节次数量对应的前提下才使用
    if (sectionRes.content.sections.length === (forenoonRes.content + afternoonRes.content + nightRes.content)) {
      tableSetting.morningNum = forenoonRes.content
      tableSetting.afternoonNum = afternoonRes.content
      tableSetting.nightNum = nightRes.content
      tableSetting.sections = sectionRes.content.sections
    } else {
      console.error('节次数量和时间信息数量不相等，不使用')
    }
  }
  return tableSetting
}

const tryRunParserLocally = async (providerRes, parser) => {
  const timeOut = () => new Promise((_, reject) => {
    setTimeout(() => reject(new Error('runParser Timeout')), 1000)
  })
  const runParser = () => new Promise((resolve, reject) => {
    const url = 'ws://127.0.0.1:2333'
    const ws = new WebSocket(url)
    ws.onopen = e => {
      consoleBlue('IDE连接成功')
      const msg = {
        to: 'IDE',
        from: 'content',
        cmd: 'runParser',
        content: {
          providerRes,
          parser
        }
      }
      ws.send(JSON.stringify(msg))
    }
    ws.onmessage = ({ data }) => {
      // 处理数据
      try {
        data = JSON.parse(data)
      } catch (_) { }
      // 过滤数据
      if (data.to !== 'content' || data.from !== 'IDE') {
        return false
      }
      // 收到了运行结果
      if (data.cmd === 'runParser') {
        // 成功运行，结果不一定通过
        if (data.content.ok) {
          let res = data.content.data
          try {
            res = JSON.parse(res)
            resolve(res)
          } catch (_) {
            reject(new Error(data.content.data))
          }
        } else {
          reject(new Error(data.content.message))
        }
      }
      ws.close()
    }
  })
  return Promise.race([runParser(), timeOut()])
}

const runDebug = async ({ provider, parser, timer }, sendResponse) => {
  const okBack = () => {
    sendResponse({
      ok: true,
      data: null,
      message: ''
    })
  }
  const failBack = message => {
    sendResponse({
      ok: false,
      data: null,
      message
    })
  }
  let providerRes = null
  let parserRes = null
  let timerRes = null
  const loadTool = name => fetch(`https://cnbj3-fusion.fds.api.xiaomi.com/miai-fe-aischedule-home-fe/tools/${name}.js`).then(r => r.text()).then(t => new Function(t)());
  window.loadTool = loadTool

  // provider 流程 -------------------------------------------
  if (!provider) {
    consoleRed('未发现Provider代码')
    return failBack('未发现Provider代码')
  }
  // 尝试运行 provider 函数
  consoleBlue('准备加载Provider代码')
  try {
    Function(provider + ';window.scheduleHtmlProvider = scheduleHtmlProvider')()
    if (typeof window.scheduleHtmlProvider === 'function') {
      providerRes = await window.scheduleHtmlProvider()
    } else {
      consoleRed('函数scheduleHtmlProvider不存在')
      return failBack('函数scheduleHtmlProvider不存在')
    }
  } catch (err) {
    consoleRed('函数scheduleHtmlProvider运行出错')
    console.error(err)
    return failBack('函数scheduleHtmlProvider运行出错')
  }
  // 返回值类型检查
  if (typeof providerRes !== 'string') {
    consoleOrange('Provider返回值数据类型不为 String')
    providerRes = String(providerRes)
  }
  // 显示函数运行结果
  consoleBlue('Provider函数执行成功')
  console.log('Provider执行结果为:', providerRes)

  // 开发者终止流程
  if (providerRes === "do not continue") {
    consoleOrange('检测到终止代码，停止执行')
    return failBack('开发者终止执行')
  }

  // parser 流程 ---------------------------------------------
  if (parser.length === 0) {
    consoleRed('未发现Parser代码')
    return failBack('未发现Parser代码')
  }
  // 尝试运行 parser 函数
  consoleBlue('准备加载Parser代码')
  try {
    // 尝试联系本机服务器
    try {
      consoleBlue('尝试链接IDE')
      parserRes = await tryRunParserLocally(providerRes, parser)
    } catch (err) {
      console.log(err)
      if (err.message !== 'runParser Timeout') {
        throw new Error(err.message)
      }
    }
    if (!parserRes) {
      consoleOrange('IDE链接失败，切换至本地运行')
      window.$ = cheerio.load(providerRes, { xmlMode: true })
      Function(parser + ';window.scheduleHtmlParser = scheduleHtmlParser')()
      if (typeof window.scheduleHtmlParser === 'function') {
        parserRes = window.scheduleHtmlParser(providerRes)
      } else {
        consoleRed('函数scheduleHtmlParser不存在')
        return failBack('函数scheduleHtmlParser不存在')
      }
    }
  } catch (err) {
    consoleRed('函数scheduleHtmlParser运行出错')
    console.error(err)
    return failBack('函数scheduleHtmlParser运行出错')
  }

  console.log('Parser执行结果为', parserRes)

  // 返回值类型检查
  if (!Array.isArray(parserRes) && !parserRes?.courseInfos) {
    consoleRed('Parser返回值数据类型不为 Array，且无courseInfos属性')
    return failBack('Parser返回值数据类型不为 Array，且无courseInfos属性')
  }
  // 展示函数运行结果
  consoleBlue('Parser函数执行成功')

  // 新版指定parser直接返回课程list，时间信息从timer来
  // 直接丢进去开始校验
  try {
    consoleBlue('Parser返回值校验开始')
    const courses = Array.isArray(parserRes)
      ? parserRes
      : parserRes?.courseInfos
    const validateRes = validateCourseInfos(courses)
    if (validateRes.content.length === 0) {
      consoleRed('校验后无可导入课程，Parser返回值校验不通过')
      return failBack('校验后无可导入课程，Parser返回值校验不通过')
    }
    if (!validateRes.canUse) {
      consoleRed('Parser返回值校验未通过')
      return failBack('Parser返回值校验未通过')
    }
    // 校验课程结束然后开始合并课程
    consoleBlue(`开始尝试进行课程合并, 合并前课程数量为：${validateRes.content.length}`)
    const packRes = packCourseInfos(validateRes.content)
    if (!packRes.canUse) {
      consoleRed('Parser返回值校验未通过')
      return failBack('Parser返回值校验未通过')
    }
    consoleBlue(`课程合并成功, 合并后课程数量为：${packRes.content.length}`)
    // 课程合并通过，校验通过并结束
    consoleBlue('Parser返回值校验通过')
    console.log('Parser返回值校验后结果为', packRes.content)
  } catch (error) {
    consoleRed('Parser返回值校验失败')
    console.error(error)
    return failBack('Parser返回值校验失败')
  }

  // timer 流程 ---------------------------------------------
  // 时间函数定义为https://xiaomi.f.mioffice.cn/docs/dock4BPFbt2DfULjRv3biqpM2jM
  if (timer.length === 0) {
    consoleOrange('未发现Timer配置代码, 跳过测试')
    consoleGreen('恭喜您！测试通过！可以上传代码进行真机测试了！')
    return okBack('测试通过')
  }
  // 尝试运行Timer函数
  consoleBlue('准备加载Timer配置代码')
  try {
    Function(timer + ';window.scheduleTimer = scheduleTimer')()
    if (typeof window.scheduleTimer === 'function') {
      timerRes = await window.scheduleTimer({
        parserRes,
        providerRes
      })
    } else {
      consoleOrange('函数scheduleTimer不存在, 跳过测试')
      consoleGreen('恭喜您！测试通过！可以上传代码进行真机测试了！')
      return okBack('测试通过')
    }
  } catch (err) {
    consoleRed('函数scheduleTimer运行出错')
    console.error(err)
    return failBack('函数scheduleTimer运行出错')
  }
  // 展示函数运行结果
  consoleBlue('Timer配置加载成功')
  console.log('Timer配置为', timerRes)

  // 开始校验
  try {
    consoleBlue('Timer配置校验开始')
    const res = verifyAndTranslateTimer(timerRes)
    if (Object.keys(res).length === 0) {
      consoleOrange('Timer配置结果为空')
    }
    consoleBlue('Timer配置校验通过')
  } catch (err) {
    console.error(err)
    consoleRed('Timer配置校验失败')
    return failBack('Timer配置校验失败')
  }

  consoleGreen('恭喜您！测试通过！可以上传代码进行真机测试了！')
  return okBack('测试通过')
}

/**
 * 事件监听器
 */
const messageListener = (message, _, sendResponse) => {
  // 虽然收不到来自背景脚本的信息但还是过滤一下
  console.log('content script get message: ', message)
  if (message?.to !== 'content') return undefined

  // 内容函数在此插件只负责跑验证函数，获取参数
  const { cmd, params } = message

  if (cmd === 'runDebug') {
    runDebug(params, sendResponse)
  }

  // 如需异步调用sendResponse则返回true
  return true
}

chrome.runtime.onMessage.addListener(messageListener)

consoleBlue('DebugRunner准备完成')