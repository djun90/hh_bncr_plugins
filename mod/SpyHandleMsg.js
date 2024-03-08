/**
 * @name SpyHandleMsg
 * @version v2.0.0
 * @author Aming
 * @origin 红灯区
 * @create_at 2033-10-27 11:12:09
 * @description 当触发的消息中没有 export线报时,触发的消息会经过此模块解析
 * @module true
 * @public false
 */

const jsonSchema = BncrCreateSchema.object({
    list: BncrCreateSchema.array(BncrCreateSchema.object({
        keyword: BncrCreateSchema.string().setTitle('keyword').setDescription(`填写正则表达式`).setDefault(""),
        name: BncrCreateSchema.string().setTitle('name').setDescription(`任务名称`).setDefault(""),
        trans: BncrCreateSchema.array(BncrCreateSchema.object({
            ori: BncrCreateSchema.string().setTitle('ori').setDescription(`当多变量的时候按顺序填写需要在链接中提取的参数`).setDefault(""),
            redi: BncrCreateSchema.string().setTitle('redi').setDescription(`青龙变量`).setDefault(""),
            sep: BncrCreateSchema.string().setTitle('sep').setDescription(`连接符`).setDefault(""),
        })).setTitle('trans').setDescription(`解析规则`).setDefault([])
    })).setTitle('解析配置').setDescription(`解析配置`).setDefault([
        {
            keyword: "",
            name: "",
            trans: []
        }
    ])
});

const ConfigDB = new BncrPluginConfig(jsonSchema);

const request = require('util').promisify(require('request'));

module.exports = async msg => {

    await ConfigDB.get();
    if (!Object.keys(ConfigDB.userConfig).length) {
        console.log('请先发送"修改无界配置",或者前往前端web"插件配置"来完成插件首次配置');
        return '';
    }
    /*
     当触发的消息中没有 export格式变量时,触发的消息会经过此模块解析
     因此,你可以在此模块中添加你对export以外的消息进行解析,返回一个export线报
    */
    const urlReg = /https:\/\/[A-Za-z0-9\-\._~:\/\?#\[\]@!$&'\*\+,%;\=]*/g;
    const codeReg = /[(|)|#|@|$|%|¥|￥|!|！][0-9a-zA-Z]{10,14}[(|)|#|@|$|%|¥|￥|!|！]/g;
    const urlArr = msg.match(urlReg)?.map(url => decodeURIComponent(url)) ?? [];
    const codeArr = msg.match(codeReg) ?? [];
    for (const [i, code] of codeArr.entries()) {
        const res = await nolanDecode(code);
        res ? (codeArr[i] = res) : codeArr.slice(i, 1);
    }
    let result = '';
    for (const link of [...urlArr, ...codeArr])
        urlToExport(link)?.forEach(e => (result += `export ${e.name}="${e.value}"\n`));
    /*
    如果该导出的函数返回值不是一个string或不是一个 export格式的线报时,该msg会被放弃
    如果该模块中的代码报错 将强制返回空字符串
    */
    return result ? `外部模块解析结果:\n${result}` : '';
};

/**
 * @Description 解析列表 取于白眼
 * 修改记录
 *   版本号[1.0.1] 修订日期[2023/4/13 9:57 AM]  修改内容 [增加多变量解析参数注释]
 *     {
 * 			keyword:"https://lzkj-isv.isvjcloud.com/app?a=xxxxx&b=xxxxxx",
 * 			trans:[
 * 				{
 * 					ori: "a b", // 当多变量的时候按顺序填写需要在链接中提取的参数
 * 					redi: "key",
 * 					sep:"&" // 连接符  结果  export key="a&b"
 * 				}
 * 		},
 *
 */
function ListS() {
    return ConfigDB.userConfig.list;
}

/* 诺兰口令解析接口 */
async function nolanDecode(code) {
    try {
        const dbUrl = await new BncrDB('AmingScript').get('deCodeHost', 'https://api.nolanstore.cc');
        return (
            await request({
                url: `${dbUrl}/JComExchange`,
                method: 'post',
                body: {
                    code,
                },
                json: true,
            })
        )?.body?.data?.jumpUrl;
    } catch (e) {
        console.log('nolanDecode ' + e);
        return void 0;
    }
}
/* 解析函数 ,改于白眼 */
function urlToExport(url) {
    // console.log('urlToExport', url);
    let ResArr = [];
    const listS = ListS();
    for (const oneList of listS) {
        if (!url.match(oneList.keyword)) continue;
        for (const r of oneList.trans) {
            let temp = {
                act: oneList.name,
                name: r.redi,
            };
            if (+r.ori === -1) {
                temp['value'] = encodeURI(url);
            } else if (r.ori.indexOf(' ') !== -1) {
                //提取多参数作为变量值
                let pn = r.ori.split(' ');
                let pv = [];
                pn.forEach(ele => {
                    console.log(ele);
                    if (!ele) return;
                    let reg = new RegExp('(?<=' + ele + '(=|%3D))[^&%]+'),
                        actid = url.match(reg);
                    if (actid) pv.push(actid[0]);
                    else console.log(url + '\n中未找到活动参数:' + ele);
                });
                if (!pv.length) break;
                if (r.sep) temp['value'] = pv.join(r.sep);
                else console.log('内置解析规则' + JSON.stringify(oneList) + '缺少分割符');
            } else {
                // 提取参数作为变量
                let reg = new RegExp(`(?<=${r.ori}(=|%3D))[^&%]+`),
                    actid = url.match(reg);
                if (!actid) break;
                temp['value'] = actid[0];
            }
            temp['value'] && ResArr.push(temp);
        }
    }
    return ResArr;
}