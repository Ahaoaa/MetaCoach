const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const app = express();

app.use(express.json());
app.use(cors());

// VivoGPT API 配置
const APP_ID = '2025301768'; 
const APP_KEY = 'jfARgbITjmaozIOL'; 
const URI = '/vivogpt/completions';
const DOMAIN = 'api-ai.vivo.com.cn';
const METHOD = 'POST';

// 生成随机 nonce
function genNonce(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < length; i++) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
}

// 生成规范化查询字符串
function genCanonicalQueryString(params) {
    if (!params || Object.keys(params).length === 0) {
        return '';
    }
    const sortedKeys = Object.keys(params).sort();
    const queryParts = sortedKeys.map(key => {
        const value = params[key] === undefined || params[key] === null ? '' : String(params[key]);
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    });
    return queryParts.join('&');
}

// 生成签名
function genSignature(appSecret, signingString) {
    const hmac = crypto.createHmac('sha256', appSecret);
    hmac.update(signingString);
    return hmac.digest('base64');
}

// 生成签名头部
function genSignHeaders(appId, appKey, method, uri, query) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = genNonce();
    const canonicalQueryString = genCanonicalQueryString(query);
    const signedHeadersString = `x-ai-gateway-app-id:${appId}\nx-ai-gateway-timestamp:${timestamp}\nx-ai-gateway-nonce:${nonce}`;
    const signingString = `${method.toUpperCase()}\n${uri}\n${canonicalQueryString}\n${appId}\n${timestamp}\n${signedHeadersString}`;
    const signature = genSignature(appKey, signingString);

    return {
        'X-AI-GATEWAY-APP-ID': appId,
        'X-AI-GATEWAY-TIMESTAMP': timestamp,
        'X-AI-GATEWAY-NONCE': nonce,
        'X-AI-GATEWAY-SIGNED-HEADERS': 'x-ai-gateway-app-id;x-ai-gateway-timestamp;x-ai-gateway-nonce',
        'X-AI-GATEWAY-SIGNATURE': signature
    };
}

// 调用 VivoGPT API
async function callVivoGPT(prompt) {
    const params = {
        requestId: uuidv4()
    };
    const data = {
        prompt: prompt,
        model: 'vivo-BlueLM-TB-Pro',
        sessionId: uuidv4(),
        systemPrompt: "你叫美塔(MetaCoach)，是一名AI 动作教练，精通广播体操教学、传统养生功法学习、舞蹈基础训练、体育动作学习、各种网红舞蹈教学等场景下的动作指导与矫正，不涉及其他不相关领域。",
        extra: {
            temperature: 0.9
        }
    };
    const headers = genSignHeaders(APP_ID, APP_KEY, METHOD, URI, params);
    headers['Content-Type'] = 'application/json';

    const url = `https://${DOMAIN}${URI}`;
    try {
        const response = await axios.post(url, data, { headers, params });
        console.log('VivoGPT API response:', response.data); // 记录 API 返回的完整数据
        if (response.status ===  200 && response.data.code === 0 && response.data.data) {
            return response.data.data.content;
        } else {
            console.error('VivoGPT API error:', response.data); // 记录 API 返回的错误信息
            return 'AI 目前无法响应，请稍后再试。';
        }
    } catch (error) {
        console.error('VivoGPT API request failed:', error); // 记录请求失败的详细信息
        return 'AI 目前无法响应，请稍后再试。';
    }
}

// 处理聊天请求
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    console.log(`收到用户消息: ${userMessage}`);

    const prompt = `用户消息: ${userMessage}`;
    const reply = await callVivoGPT(prompt);
    console.log(`AI 回复: ${reply}`); // 记录 AI 的回复内容
    res.json({ reply });
});

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));