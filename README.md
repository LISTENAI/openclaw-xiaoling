# openclaw-xiaoling

OpenClaw × [小聆 AI](https://docs2.listenai.com/x/S_TEd8h7C) 插件。

## 安装

```sh
npx -y @listenai/openclaw-xiaoling install
```

## 开发

1. 启动本地 OpenClaw 实例

    ```sh
    docker compose up
    ```

2. Onboard 并批准您的浏览器（如果需要）

    ```sh
    docker compose exec openclaw openclaw onboard
    docker compose exec openclaw openclaw config set gateway.bind lan
    docker compose exec openclaw openclaw devices list
    docker compose exec openclaw openclaw devices approve xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    ```

3. 添加 channel

    ```sh
    docker compose exec openclaw openclaw channels add --channel openclaw-xiaoling
    ```
