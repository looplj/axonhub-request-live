# 实时请求

侧栏页面插件。四列从左到右是：

**客户端 → API 密钥 → AxonHub → 渠道**

每一列只回答一件事：请求从哪个客户端来、用了哪把 API 密钥、经过 AxonHub、最后实际打到哪个渠道。页面不画路由过程，不解释为什么选了这个渠道，也不展示请求或响应正文、请求头、流式分片、上游 URL、用量或配额。

客户端靠 `Request.userAgent` 识别。产品名是 User-Agent 里第一个 `/` 或空格之前的词。已知客户端（Claude Code、Codex、Cursor 等）按别名和前缀匹配。`source` 为 `playground` 时一律算作 Playground，避免管理台浏览器被显示成 Chrome。空 User-Agent 且来源是 `test` 时显示为 Test，其余显示为未知客户端。

数据只来自插件 GraphQL 的轮询，没有订阅。有 `pending` 或 `processing` 的请求时每 2 秒拉一次，否则每 5 秒。页面隐藏时暂停计时，重新可见时立刻再拉一次。

## 权限

安装时需要授予：

- `read_requests`：读取请求和执行记录
- `read_api_keys`：读取 API 密钥名称和状态
- `read_channels`：读取渠道名称

没有 `read_channels` 时，列表会改用不含渠道对象的查询，渠道列只显示渠道 ID，并给出一行权限提示。

## 打包

安装 AxonHub `unstable` 分支上的打包器。分支名可以直接作为版本，不需要 `cmd/pack-plugin/vX.Y.Z` 标签：

```bash
go install github.com/looplj/axonhub/cmd/pack-plugin@unstable
```

仓库里还有 workflow、README 和测试，不能直接把仓库根交给打包器。先复制要发布的文件：

```bash
stage=$(mktemp -d)
cp manifest.json "$stage/"
cp -R ui "$stage/"
pack-plugin "$stage" -o "$PWD/request-live-$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])').axplugin"
```

## 发布

推送 `v` 开头的语义化版本标签（如 `v0.2.0`）会触发 `.github/workflows/release.yml`：先跑 `format.test.mjs`，再把 `manifest.json` 的版本改成标签版本并提交回默认分支，然后只打包 `manifest.json` 和 `ui/`，把 `request-live-<版本>.axplugin` 和 `checksums.txt` 上传到同名 GitHub Release。

```bash
git tag v0.2.0
git push origin v0.2.0
```

## 安装

用 Owner 账号在「插件」页上传 `.axplugin` 插件包，勾选上面的三项权限后启用。侧栏入口是「实时请求」，地址是 `/plugins/local.request-live/pages/live`。
