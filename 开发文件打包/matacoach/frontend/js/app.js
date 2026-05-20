// app.js

// 状态管理对象，存储应用运行时状态
const AppState = {
    mediaStream: null,        // 摄像头流
    isAnalyzing: false,       // 是否正在分析
    animationFrameId: null,   // 动画帧ID，用于控制动画循环
    totalFrames: 0,           // 总帧数，用于计算帧率
    startTime: Date.now(),    // 开始时间，用于性能统计
    showSkeleton: true        // 是否显示骨骼追踪，默认显示
};

// DOM 元素引用，便于快速访问页面元素
const DOM = {
    video: document.getElementById('video'),              // 视频元素
    skeletonCanvas: document.getElementById('skeletonCanvas'), // 骨架画布
    cameraBtn: document.getElementById('cameraBtn'),      // 摄像头按钮
    analyzeBtn: document.getElementById('analyzeBtn'),    // 分析按钮
    toggleSkeletonBtn: document.getElementById('toggleSkeletonBtn'), // 骨骼追踪切换按钮
    fpsCounter: document.getElementById('fpsCounter'),    // 帧率显示
    feedbackText: document.getElementById('feedbackText'), // 反馈文本区域
    chatOutput: document.getElementById('chatOutput'),    // 聊天输出区域
    chatInput: document.getElementById('chatInput'),      // 聊天输入框
    sendChatBtn: document.getElementById('sendChatBtn'),  // 发送聊天按钮
    animationCheckboxList: document.getElementById('animationCheckboxList'), // 动画复选框容器
};

// 定义全局 Camera 对象，用于 MediaPipe 摄像头控制
let camera = null;

// 初始化 MediaPipe Pose，用于人体姿态检测
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`, // 加载 Pose 模型文件
});
pose.setOptions({
    modelComplexity: 1,          // 模型复杂度（0-2），1 是平衡选择
    smoothLandmarks: true,       // 平滑关键点，减少抖动
    enableSegmentation: false,   // 不需要分割，节省性能
    minDetectionConfidence: 0.5, // 检测置信度阈值
    minTrackingConfidence: 0.5   // 跟踪置信度阈值
});

// 监听检测结果，处理姿态数据
pose.onResults(onResults);

console.log("Pose initialized");

// DOM 加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 示例：大模型反馈控制动画（后期扩展用）
    function handleModelFeedback(feedback) {
        if (typeof feedback === 'string' && feedback.startsWith('play_')) {
            const animationName = feedback.replace('play_', '').toLowerCase(); // 提取动画名称
            const animationIndex = threeJSInstance.getAnimationNames()
                .findIndex(name => name.toLowerCase() === animationName); // 查找匹配的动画索引
            if (animationIndex !== -1) {
                threeJSInstance.playAnimation(animationIndex); // 播放指定动画
                DOM.feedbackText.textContent = `正在播放 ${animationName} 动画`;
                console.log(`Feedback: Playing ${animationName} (index: ${animationIndex})`);
            } else {
                DOM.feedbackText.textContent = `未找到动画: ${animationName}`;
                console.log(`Feedback: Animation ${animationName} not found`);
            }
        } else if (feedback === 'stop_all') {
            threeJSInstance.animations.forEach((_, index) => {
                threeJSInstance.stopAnimation(index); // 停止所有动画
            });
            DOM.feedbackText.textContent = '所有动画已停止';
            console.log('Feedback: All animations stopped');
        }
    }

    // 模拟大模型反馈（测试用，注释掉以避免干扰）
    // setTimeout(() => handleModelFeedback('play_hip hop dance'), 5000);

    // 初始化事件监听
    function initEventListeners() {
        DOM.cameraBtn.addEventListener('click', toggleCamera);
        DOM.analyzeBtn.addEventListener('click', toggleAnalysis);
        DOM.sendChatBtn.addEventListener('click', sendChatMessage);
        DOM.toggleSkeletonBtn.addEventListener('click', toggleSkeleton);
        console.log('事件监听已注册');
    }

    console.log('DOM准备就绪');
    initEventListeners();

    // 页面加载时朗读开场白
    const openingText = '你好！我是美塔，你的 AI 动作教练，今天想学些什么呢？';
    handleAIResponse(openingText); // 显示并朗读开场白
});

// 处理检测结果
function onResults(results) {
    const canvasCtx = DOM.skeletonCanvas.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, DOM.skeletonCanvas.width, DOM.skeletonCanvas.height);

    if (results.poseLandmarks) {
        console.log("骨骼数据:", results.poseLandmarks);
        // 仅在 showSkeleton 为 true 时绘制骨骼
        if (AppState.showSkeleton) {
            drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
            drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2 });
        }
        if (AppState.isAnalyzing) {
            sendToBackend(results.poseLandmarks); // 始终发送数据到后端
        }
    } else {
        console.log("未检测到骨骼数据");
    }
    canvasCtx.restore();
    updateFPS(); // 更新帧率
}

// 启动摄像头
async function startCamera() {
    try {
        AppState.mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: "user" }
        });
        DOM.video.srcObject = AppState.mediaStream;
        DOM.analyzeBtn.disabled = false;
        DOM.cameraBtn.textContent = '关闭摄像头';

        // 设置 canvas 尺寸与视频一致
        DOM.skeletonCanvas.width = DOM.video.videoWidth || 1280;
        DOM.skeletonCanvas.height = DOM.video.videoHeight || 720;

        // 使用 Camera 工具启动视频流
        camera = new Camera(DOM.video, {
            onFrame: async () => {
                await pose.send({ image: DOM.video });
            },
            width: 1280,
            height: 720
        });
        camera.start();
        console.log('摄像头已启动');
    } catch (err) {
        console.error('摄像头错误:', err);
    }
}

// 关闭摄像头
function stopCamera() {
    if (camera) {
        camera.stop(); // 停止 Camera 的帧处理
    }
    if (AppState.mediaStream) {
        AppState.mediaStream.getTracks().forEach(track => track.stop());
    }
    AppState.mediaStream = null;
    DOM.video.srcObject = null; // 清除视频源
    DOM.analyzeBtn.disabled = true;
    DOM.cameraBtn.textContent = '启动摄像头';

    // 清除 canvas 上的骨骼绘制
    const canvasCtx = DOM.skeletonCanvas.getContext('2d');
    canvasCtx.clearRect(0, 0, DOM.skeletonCanvas.width, DOM.skeletonCanvas.height);
    
    console.log('摄像头已关闭');
}

// 切换摄像头状态
function toggleCamera() {
    console.log('摄像头按钮点击');
    if (AppState.mediaStream) {
        stopCamera();
    } else {
        startCamera();
    }
}

// 切换分析状态
function toggleAnalysis() {
    AppState.isAnalyzing = !AppState.isAnalyzing;
    console.log("分析状态:", AppState.isAnalyzing);
    DOM.analyzeBtn.textContent = AppState.isAnalyzing ? '停止分析' : '开始分析';
    if (AppState.isAnalyzing) {
        AppState.startTime = Date.now(); // 重置开始时间
        AppState.totalFrames = 0;        // 重置帧数
    }
}

// 切换骨骼显示状态
function toggleSkeleton() {
    AppState.showSkeleton = !AppState.showSkeleton;
    DOM.toggleSkeletonBtn.textContent = AppState.showSkeleton ? '隐藏骨骼追踪' : '显示骨骼追踪';
    console.log("骨骼显示状态:", AppState.showSkeleton);
}

// 发送数据到后端
async function sendToBackend(landmarks) {
    try {
        const response = await fetch('http://localhost:3000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ landmarks }) // 移除 action 参数，依赖聊天输入
        });
        const data = await response.json();
        displayFeedback(data.feedback);
    } catch (err) {
        console.error('后端请求错误:', err);
    }
}

// 显示反馈
function displayFeedback(feedback) {
    if (DOM.feedbackText) {
        DOM.feedbackText.textContent = feedback;
    } else {
        console.error('未找到 feedbackText 元素');
    }
}

// 更新帧率显示
const fpsSamples = [];
const MAX_FPS_SAMPLES = 30; // 30 帧的滑动窗口

function updateFPS() {
    AppState.totalFrames++;
    const elapsedTime = (Date.now() - AppState.startTime) / 1000;
    const fps = AppState.totalFrames / elapsedTime;

    fpsSamples.push(fps);
    if (fpsSamples.length > MAX_FPS_SAMPLES) {
        fpsSamples.shift(); // 保持最大样本数
    }

    // 计算平均 FPS
    const avgFps = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
    DOM.fpsCounter.textContent = `${avgFps.toFixed(1)} FPS`;
}

// 语音朗读函数
function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN'; // 设置为中文
        speechSynthesis.speak(utterance);
    } else {
        console.log('浏览器不支持语音合成');
    }
}

// 处理 AI 回复并显示
function handleAIResponse(response) {
    const aiMessage = document.createElement('div');
    aiMessage.classList.add('ai-message');
    aiMessage.innerHTML = `<img src="./imgs/mita.jpg" alt="美塔" class="avatar"><p>${response}</p>`;
    DOM.chatOutput.appendChild(aiMessage);
    DOM.chatOutput.scrollTop = DOM.chatOutput.scrollHeight; // 自动滚动到底部

    // 朗读 AI 回复
    speakText(response);
}

// 发送聊天消息
async function sendChatMessage() {
    const userInput = DOM.chatInput.value.trim();
    if (!userInput) return; // 避免空输入

    // 显示用户消息
    const userMessage = document.createElement('div');
    userMessage.classList.add('user-message');
    userMessage.innerHTML = `<img src="./imgs/user-avatar.jpg" alt="用户" class="avatar"><p>${userInput}</p>`;
    DOM.chatOutput.appendChild(userMessage);
    DOM.chatOutput.scrollTop = DOM.chatOutput.scrollHeight;

    // 清空输入框
    DOM.chatInput.value = '';

    try {
        const response = await fetch("http://localhost:3000/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userInput })
        });

        const data = await response.json();
        handleAIResponse(data.reply);
    } catch (err) {
        console.error("聊天请求错误:", err);
        handleAIResponse("服务器错误，请稍后再试。");
    }
}

// 初始化事件监听
function initEventListeners() {
    DOM.cameraBtn.addEventListener('click', toggleCamera);
    DOM.analyzeBtn.addEventListener('click', toggleAnalysis);
    DOM.sendChatBtn.addEventListener('click', sendChatMessage);
    DOM.toggleSkeletonBtn.addEventListener('click', toggleSkeleton);
    console.log('事件监听已注册');
}

// 启动
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM准备就绪');
    initEventListeners();

});