# 新版教务系统身份认证部分解析
在新版教务系统中，身份认证使用cookie和x-token两个方式认证
用户登陆后，服务器会返回一个token,然后通过这个token向服务器请求获取x-token并保存在cookie中的Admin-Token字段中
通过API向服务器请求时，数据包头中需要带有x-token字段。该字段可通过代码从cookie中获取

第一个token在请求完x-token就没有再使用了，后续数据包中均使用x-token进行身份认证。

# 请求数据包编辑
## API接口信息
在新版教务系统中，前端页面通过API接口方式请求获取课表，请求地址为：`https://neweas.wvpn.huat.edu.cn/api/teachTask/list`，请求方式为POST
## 数据包体信息
在请求课表时，数据包体中需要带有三个数据，分别为studId（对应登陆用户的学号）、weekNum（当前查询的周数）以及yearTermId（查询的学年以及学期）
> 其中，studId使用弹窗的方式让用户输入（该代码目前没有进行API请求适配）

weekNum留空时服务器判定为查询该学期全部课表，与课表导入场景契合，故在该代码中留空

yearTermId由两部分组成，学年和学期。组成方式为学年+学期。例如20242表示2024年第二学期（1表示第一学期，也就是上学期;2表示第二学期，也就是下学期）
> yearTermId由于是由用户主动选择，故无法通过API接口方式从服务器请求，只能弹窗让用户输入

> 注意，此处需要让用户分清楚学年开始年份和学期开始年份的区别。如2024年第二学期的开始时间在2025年，但是此处需要填写2024年，也就是本学年的开始时间。因为教务系统是根据学年的开始时间进行查询。此处需要明确提醒用户或根据用户执行该代码的时间进行异常处理

# 服务器返回数据包体解析
在数据包的data内容中，有着以下内容：
### 1. 基本课程信息
#### yearTermId:
类型：字符串
含义：学年学期标识符，例如“20242”可能表示2024年的第二学期。
#### courName:
类型：字符串
含义：课程名称。
#### itemBatchId:
类型：字符串（可为空）
含义：批次ID，用于区分不同批次的教学任务，可能为空。
#### weekSection:
类型：字符串
含义：周次与节次的组合，例如“42”可能表示第4周的第2节课。
#### courId:
类型：字符串
含义：课程ID，用于唯一标识课程，例如“06111080”。
#### courOrder:
类型：整数
含义：课程顺序号，可能是课程在某类课程中的排列序号。
#### weekBegin:
类型：整数
含义：课程开始的周次，例如“1”表示从第1周开始。
#### weekEnd:
类型：整数
含义：课程结束的周次，例如“8”表示到第8周结束。
#### lessType:
类型：字符串
含义：课程类型，例如“全周”表示每周都有的课程。
#### totalNum:
类型：空值
含义：总人数或总课时数，可能为空。
### 2. 教师信息
#### teachResponse:
类型：对象
含义：教师相关信息的集合。
#### courTeacherName1, courTeacherName2, courTeacherName3, courTeacherName4:
类型：字符串
含义：授课教师的名字，最多支持4名教师。
#### courTeacher1, courTeacher2, courTeacher3, courTeacher4:
类型：字符串
含义：教师ID，用于唯一标识教师。
#### courTeacherTitle1, courTeacherTitle2, courTeacherTitle3, courTeacherTitle4:
类型：空值
含义：教师职称，例如教授、副教授等，可能为空。
#### teacherList:
类型：数组
含义：教师列表，每项包含教师的具体信息。
#### teacherId:
类型：字符串
含义：教师ID。
#### teacherName:
类型：字符串
含义：教师姓名。
#### teacherTitle:
类型：空值
含义：教师职称，例如教授、副教授等，可能为空。
### 3. 课程安排细节
#### roomId:
类型：字符串
含义：教室编号，例如“5304”。
#### weekDay:
类型：整数
含义：上课的星期几，例如“4”表示星期四。
#### startSection:
类型：整数
含义：课程开始的节次，例如“3”表示第3节课。
#### endSection:
类型：整数
含义：课程结束的节次，例如“4”表示第4节课。
#### state:
类型：字符串
含义：课程状态，例如“理论课”。
#### sectionTime:
类型：整数
含义：课程持续的时间长度（以节为单位），例如“2”表示两节课。
#### schoolAddr:
类型：字符串
含义：上课地点，例如“校本部”。
#### taskMemo:
类型：空值
含义：备注信息，可能为空。
## > **注意，此处的信息为对数据包本身的解析，小爱课程表导入插件只会用到其中的几个项目，无需全部解析**

# 时间处理函数部分
对于汽院来说，一般一个学期持续最多18周，故将课程时长硬编码为18

为简化逻辑，直接取代码执行时间为学期开始时间。

代码中增加了对夏季时间和秋季时间的判断。
> 当代码执行月份为5-9月时判定为夏季

课程具体时间一般不会变化，故直接进行硬编码

以上就是对湖北汽车工业学院的新版教务系统的身份认证解析以及课表部分的数据包解析还有对我的导入代码的部分解析，欢迎参考
