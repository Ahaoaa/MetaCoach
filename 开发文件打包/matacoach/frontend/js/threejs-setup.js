// threejs-setup.js

// 全局变量，用于存储 Three.js 实例，避免重复初始化
let threeJSInstance;

function initThreeJS() {
    // 获取容器元素，用于渲染 3D 模型
    const container = document.getElementById('metaModelContainer');
    if (!container) {
        console.error('Container element not found!');
        return;
    }

    // 创建场景，Three.js 的核心容器
    const scene = new THREE.Scene();

    // 设置图片背景
    const textureLoader = new THREE.TextureLoader();
    scene.background = textureLoader.load('./imgs/background.png'); // 加载图片作为背景，调整路径以匹配你的文件位置

    // 创建相机，定义视角和视口
    const threeCamera = new THREE.PerspectiveCamera(
        75, // 视角（FOV）
        container.clientWidth / container.clientHeight, // 宽高比
        0.1, // 近裁剪面
        1000 // 远裁剪面
    );
    threeCamera.position.set(0, 1, 2); // 设置相机位置，稍微拉远以便观察模型

    // 创建渲染器，将场景渲染到画布上
    const renderer = new THREE.WebGLRenderer({ antialias: true }); // 启用抗锯齿
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement); // 将渲染器添加到容器中

    // 添加光源，提升模型可见性
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 环境光，柔和全局照明
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5); // 定向光，模拟太阳光
    directionalLight.position.set(0, 1, 1); // 设置光源位置
    scene.add(directionalLight);

    // 处理窗口大小调整，保持画布自适应
    window.addEventListener('resize', () => {
        const container = document.getElementById('metaModelContainer');
        threeCamera.aspect = container.clientWidth / container.clientHeight; // 更新相机宽高比
        threeCamera.updateProjectionMatrix(); // 更新投影矩阵
        renderer.setSize(container.clientWidth, container.clientHeight); // 更新渲染器大小
    });

    // 定义动画相关变量
    let mixer; // AnimationMixer，用于管理动画播放
    let model; // 模型对象
    let animations = []; // 动画剪辑数组
    const animationActions = {}; // 存储每个动画的 AnimationAction

    // 加载 glTF 模型
    const loader = new THREE.GLTFLoader();
    loader.load(
        './gltf/米塔5.11.1.glb', // 模型路径（根据你的项目调整）
        (gltf) => {
            model = gltf.scene; // 获取模型场景
            scene.add(model); // 添加到场景中
            model.position.set(0, 0, 0); // 调整模型位置
            model.scale.set(1, 1, 1); // 调整模型缩放

            // 初始化 AnimationMixer，用于控制动画
            mixer = new THREE.AnimationMixer(model);
            animations = gltf.animations; // 获取动画列表

            // 检查是否有可用动画并初始化动作
            if (animations && animations.length > 0) {
                console.log('Available animations:', animations.map(a => a.name));
                animations.forEach((clip, index) => {
                    animationActions[index] = mixer.clipAction(clip); // 创建动画动作
                    animationActions[index].stop(); // 确保初始状态为停止
                });

                // 查找并播放“打招呼”动画（名称包含“greet”或“hello”）
                const greetAnimation = animations.find((clip) =>
                    clip.name.toLowerCase().includes('打招呼') ||
                    clip.name.toLowerCase().includes('hello')
                );
                if (greetAnimation) {
                    const greetAction = mixer.clipAction(greetAnimation);
                    greetAction.setLoop(THREE.LoopOnce); // 设置为单次播放
                    greetAction.clampWhenFinished = true; // 播放完后保持最后一帧
                    greetAction.reset().play(); // 播放打招呼动画
                    console.log('Playing greeting animation:', greetAnimation.name);
                } else {
                    console.log('No greeting animation found.');
                }

                // 填充动画复选框到下拉菜单
                const animationCheckboxList = document.getElementById('animationCheckboxList');
                animationCheckboxList.innerHTML = ''; // 清空默认内容
                animations.forEach((clip, index) => {
                    const div = document.createElement('div'); // 每个动画一个容器
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `anim-${index}`; // 唯一 ID
                    checkbox.value = index;

                    const label = document.createElement('label');
                    label.htmlFor = `anim-${index}`;
                    label.textContent = clip.name || `Animation ${index}`; // 显示动画名称

                    div.appendChild(checkbox);
                    div.appendChild(label);
                    animationCheckboxList.appendChild(div);

                    // 监听复选框变化，控制动画播放
                    checkbox.addEventListener('change', (e) => {
                        if (e.target.checked) {
                            // 停止其他动画，确保只播放当前选中的动画
                            Object.values(animationActions).forEach((action, i) => {
                                if (i !== index) action.stop();
                            });
                            animationActions[index].reset().play();
                            console.log(`Playing animation: ${clip.name}`);
                        } else {
                            animationActions[index].stop();
                            console.log(`Stopped animation: ${clip.name}`);
                        }
                    });
                });

                // 添加下拉菜单按钮的点击事件
                const dropdownBtn = document.getElementById('animationDropdownBtn');
                dropdownBtn.addEventListener('click', () => {
                    animationCheckboxList.classList.toggle('show'); // 切换菜单显示状态
                });

                // 点击页面其他区域时关闭下拉菜单
                document.addEventListener('click', (e) => {
                    if (!dropdownBtn.contains(e.target) && !animationCheckboxList.contains(e.target)) {
                        animationCheckboxList.classList.remove('show');
                    }
                });
            } else {
                console.log('No animations found in the model.');
                document.getElementById('animationCheckboxList').innerHTML = '<p>无可用动画</p>';
            }
            console.log('Model loaded successfully');
        },
        undefined, // 加载进度回调（可选）
        (error) => {
            console.error('Error loading glTF model:', error); // 错误处理
        }
    );

    // 时钟用于计算每帧时间差，更新动画
    const clock = new THREE.Clock();

    // 渲染循环，持续更新场景和动画
    function animate() {
        requestAnimationFrame(animate);
        if (mixer) {
            const delta = clock.getDelta(); // 获取帧间时间差
            mixer.update(delta); // 更新动画状态
        }
        renderer.render(scene, threeCamera); // 渲染场景，使用调整后的相机变量名
    }
    animate();

    // 返回接口，供外部控制动画和访问数据
    return {
        mixer, // AnimationMixer 实例
        animations, // 动画剪辑数组
        scene, // 场景对象
        camera: threeCamera, // 相机对象，使用调整后的变量名
        renderer, // 渲染器对象
        playAnimation: (index) => { // 播放指定索引的动画
            if (animationActions[index]) {
                // 停止其他动画
                Object.values(animationActions).forEach((action, i) => {
                    if (i !== index) action.stop();
                });
                animationActions[index].reset().play();
            }
        },
        stopAnimation: (index) => { // 停止指定索引的动画
            if (animationActions[index]) {
                animationActions[index].stop();
            }
        },
        getAnimationNames: () => animations.map(a => a.name) // 获取动画名称列表
    };
}

// 只在首次加载时初始化，确保全局实例唯一
if (!threeJSInstance) {
    document.addEventListener('DOMContentLoaded', () => {
        threeJSInstance = initThreeJS();
    });
}