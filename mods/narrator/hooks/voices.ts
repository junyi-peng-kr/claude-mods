// The narrator's voices: templates per beat. `{f}` is the subject (a file, a
// command, a duration; for pass and fail a count phrase: `12 项` / `全部`, `2 处` / `有`), `{n}` the ordinal of reads this turn (第三).
// Claude is never "he" or "she": each voice has its own epithet (少侠, 侦探,
// 舰长) or, for the documentary, 它.
import type { Beat, Voice } from '../types'

export const VOICE_ZH: Record<Voice, string> = { wuxia: '武侠', detective: '侦探', space: '太空歌剧', docu: '纪录片' }

export const VOICE_ALIASES: Record<string, Voice> = {
  wuxia: 'wuxia',
  武侠: 'wuxia',
  detective: 'detective',
  noir: 'detective',
  侦探: 'detective',
  space: 'space',
  opera: 'space',
  太空: 'space',
  太空歌剧: 'space',
  docu: 'docu',
  nature: 'docu',
  纪录片: 'docu',
}

export const LINES: Record<Voice, Record<Beat, string[]>> = {
  wuxia: {
    first: ['夜色渐深，少侠拔剑出鞘，新的一章开始了。', '江湖路远，少侠再次启程。', '风起，少侠睁开了眼睛。'],
    read: ['少侠翻开{n}本秘籍《{f}》，凝神细读。', '少侠展开卷轴《{f}》，眉头微挑。', '「{f}」——少侠低声念出这个名字，似有所悟。'],
    search: ['少侠以神识扫过整座藏经阁，寻觅「{f}」的踪迹。', '少侠闭目运功，搜寻「{f}」的气息。'],
    edit: ['少侠提笔，在《{f}》上改了几处招式。', '剑光一闪，《{f}》中的破绽已被补上。', '少侠在《{f}》里添了一记后手。'],
    write: ['少侠挥毫泼墨，写下新篇《{f}》。', '一部新的秘籍《{f}》就此问世。'],
    exec: ['少侠运起内力，催动「{f}」。', '少侠一声清啸，施展「{f}」。', '「{f}」——少侠出招了。'],
    agent: ['少侠飞鸽传书，请同门去办「{f}」。', '少侠召来师弟：「{f}，交给你了。」'],
    web: ['少侠遣人下山打探：{f}。', '江湖传来消息：{f}。'],
    other: ['少侠略一沉吟，使出「{f}」。', '少侠袖中一动：{f}。'],
    pass: ['剑气纵横，{f}试炼尽数通过！', '一招一式皆合法度，{f}试炼全过。', '少侠收剑入鞘：{f}关隘已破。'],
    fail: ['一口鲜血涌上喉头——{f}破绽未能补上。', '少侠被震退三步，{f}破绽仍在。', '此阵未破，{f}关隘失守，少侠调息再战。'],
    commit: ['少侠将今日所悟刻入石碑：「{f}」。', '一笔落定，载入门派史册：「{f}」。'],
    push: ['飞鸽已出，消息传遍江湖。', '少侠将秘籍送往总坛。'],
    done: ['历时 {f}，少侠终于收招，长出一口气。', '一场鏖战持续了 {f}，此刻尘埃落定。'],
    idle: ['少侠盘膝而坐，静待下一个挑战。', '山风吹过，少侠闭目养神。'],
  },
  detective: {
    first: ['雨夜，侦探推开了事务所的门。新的案子。', '电话响了。侦探拿起听筒：“说吧。”', '侦探在黑板上画下了第一条线。'],
    read: ['侦探翻开{n}份卷宗（{f}），眉头微皱……', '“{f}，”侦探喃喃道，“有意思。”', '侦探把 {f} 举到灯下，逐行端详。'],
    search: ['侦探在档案室里翻找「{f}」的线索。', '“一定有人提过「{f}」。”侦探开始搜查。'],
    edit: ['侦探在 {f} 的页边写下一行批注。', '侦探悄悄改动了 {f} 里的一处细节。', '证据补全了：{f}。'],
    write: ['侦探起草了一份新的报告：{f}。', '一份新档案摆上了桌：{f}。'],
    exec: ['侦探拨通了一个号码：{f}。', '侦探决定亲自走一趟：{f}。', '“试试 {f}，”侦探说，“看谁先慌。”'],
    agent: ['侦探派出了线人：{f}。', '侦探给老搭档递了张纸条：{f}。'],
    web: ['侦探翻开了今天的报纸：{f}。', '一通越洋电话：{f}。'],
    other: ['侦探点燃一支烟，做了个决定：{f}。'],
    pass: ['真相大白：{f}证词全部吻合。', '“案子结了。”侦探合上笔记本——{f}证词无一矛盾。'],
    fail: ['不对劲。{f}证词互相矛盾。', '嫌疑人还在逃——{f}破绽没堵上。', '侦探盯着报告，沉默了很久：{f}细节对不上。'],
    commit: ['侦探在结案报告上签了字：「{f}」。', '档案归档：「{f}」。'],
    push: ['报告已经送往警局。', '信封投进了邮筒，再也收不回来了。'],
    done: ['这个案子花了 {f}。侦探揉了揉太阳穴。', '{f}之后，城市的灯一盏盏熄了。'],
    idle: ['侦探靠在椅背上，等待下一个委托。', '窗外的雨还在下。'],
  },
  space: {
    first: ['舰桥灯光亮起，舰长回到了指挥席。', '星历新的一页。舰长下达了第一道命令。', '曲速引擎预热完毕。'],
    read: ['舰长调出{n}份星图：{f}。', '扫描仪锁定 {f}，数据正在回传。', '舰长凝视着 {f} 的全息投影。'],
    search: ['全舰进入扫描模式，搜索信号「{f}」。', '深空雷达在星区里寻找「{f}」。'],
    edit: ['工程舱回报：{f} 的护盾参数已重新校准。', '舰长下令改写 {f} 的航线。', '{f} 的导航程序已打上补丁。'],
    write: ['新的舰船日志已建立：{f}。', '一份新的星图被绘制出来：{f}。'],
    exec: ['引擎点火：{f}。', '“执行 {f}，”舰长说，“现在。”', '跃迁坐标确认：{f}。'],
    agent: ['一艘护卫舰脱离编队，前去执行：{f}。', '登陆小队出发：{f}。'],
    web: ['远程通讯阵列接收到讯号：{f}。', '来自外星区的广播：{f}。'],
    other: ['舰桥上响起提示音：{f}。'],
    pass: ['{f}系统读数绿灯，航线畅通！', '舰队安然穿过小行星带，{f}检查通过。'],
    fail: ['警报！{f}系统报告故障。', '船体受损——{f}读数异常。', '红色警戒：{f}检查未通过。'],
    commit: ['舰长日志，补充记录：「{f}」。', '航行记录已封存：「{f}」。'],
    push: ['讯息已穿越星门，传回母星。', '数据包以光速离港。'],
    done: ['历经 {f}，舰队终于抵达目的地。', '{f} 的航程结束，舰桥恢复了平静。'],
    idle: ['舰船在轨道上静静漂浮，等待新的命令。'],
  },
  docu: {
    first: ['清晨，Claude 醒来，开始了新一天的觅食。', '镜头前，它再次开始工作。', '在这片代码的原野上，新的一天开始了。'],
    read: ['它停在{n}个文件 {f} 前，小心地嗅了嗅。', '它仔细端详着 {f}，似乎在辨认什么。'],
    search: ['为了寻找「{f}」，它开始在整片领地里搜寻。', '它沿着气味的痕迹追踪「{f}」。'],
    edit: ['它熟练地修补着 {f}，就像织巢的鸟。', '经过反复确认，它对 {f} 做了一处改动。'],
    write: ['一个新的巢穴诞生了：{f}。', '它从零开始筑起了 {f}。'],
    exec: ['它发出了一声召唤：{f}。', '这是它最常用的技巧之一：{f}。'],
    agent: ['它召来了同伴，共同完成「{f}」。'],
    web: ['它将目光投向远方：{f}。'],
    other: ['它做出了一个出人意料的举动：{f}。'],
    pass: ['成功了。{f}测试通过，这是生存的胜利。', '努力得到了回报：{f}测试通过。'],
    fail: ['并不是每一次尝试都会成功：{f}测试没能通过。', '自然界是残酷的，{f}测试失败了。'],
    commit: ['它把成果小心地储藏起来：「{f}」。'],
    push: ['成果被带到了更远的地方。'],
    done: ['这次迁徙持续了 {f}。', '{f}之后，它终于停下来休息。'],
    idle: ['它安静下来，等待下一次机会。'],
  },
}

const ORD = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

export const ordinal = (n: number) => (n <= 10 ? `第${ORD[n]}` : `第${n}`)

/** One line for `beat`, never the same template twice in a row for a voice and beat. */
export function pick(voice: Voice, beat: Beat, last: Map<string, number>, random: () => number = Math.random): string {
  const list = LINES[voice][beat]
  const key = `${voice}:${beat}`
  let i = Math.floor(random() * list.length)
  if (list.length > 1 && i === last.get(key)) i = (i + 1) % list.length
  last.set(key, i)
  return list[i]!
}

export const fill = (template: string, f: string, n: number) => template.replace(/\{f\}/g, f).replace(/\{n\}/g, ordinal(n))
