# Node.js SSL 证书问题修复指南

## 问题描述

在 macOS 上使用 Node.js (通过 tsx 或直接运行) 发起 HTTPS 请求时，可能会遇到以下错误：

```
fetch failed
Error: unable to get local issuer certificate
code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'
```

这个问题常见于调用外部 API（如 DeepSeek、OpenAI 等）时。

## 问题原因

Node.js 使用自己的证书存储，而不是系统的证书存储。当系统证书链不完整或 Node.js 无法访问时，就会出现此错误。

有趣的是，Bun 运行时不受此问题影响，因为它使用系统原生的 TLS 实现。

## 解决方案

### 步骤 1：导出 macOS 系统证书

```bash
mkdir -p ~/.ssl
security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain > ~/.ssl/ca-certs.pem
```

这会将 macOS 系统的所有根证书导出到 `~/.ssl/ca-certs.pem` 文件。

### 步骤 2：配置 Node.js 使用这些证书

在 shell 配置文件中添加环境变量。

**对于 Zsh (macOS 默认)**：

```bash
echo '' >> ~/.zshrc
echo '# Node.js SSL certificates (fix for UNABLE_TO_GET_ISSUER_CERT_LOCALLY)' >> ~/.zshrc
echo 'export NODE_EXTRA_CA_CERTS="/Users/$(whoami)/.ssl/ca-certs.pem"' >> ~/.zshrc
```

**对于 Bash**：

```bash
echo '' >> ~/.bashrc
echo '# Node.js SSL certificates (fix for UNABLE_TO_GET_ISSUER_CERT_LOCALLY)' >> ~/.bashrc
echo 'export NODE_EXTRA_CA_CERTS="/Users/$(whoami)/.ssl/ca-certs.pem"' >> ~/.bashrc
```

> **注意**：使用绝对路径而不是 `$HOME`，因为某些情况下（如 npm scripts）`$HOME` 可能无法正确展开。

### 步骤 3：使配置生效

**方法 A**：重新打开终端

**方法 B**：在当前终端执行：

```bash
source ~/.zshrc  # 或 source ~/.bashrc
```

**方法 C**：临时设置（仅当前会话）：

```bash
export NODE_EXTRA_CA_CERTS="$HOME/.ssl/ca-certs.pem"
```

## 验证修复

```bash
node -e "fetch('https://api.deepseek.com/chat/completions').then(r => console.log('OK, status:', r.status)).catch(e => console.log('Error:', e.message))"
```

成功输出应该是 `OK, status: 401`（401 是因为没有认证，但说明网络连接成功）。

## 替代方案

### 方案 A：使用 Bun 代替 Node.js

Bun 使用系统原生 TLS，不受此问题影响：

```json
{
  "scripts": {
    "start": "bun run src/index.ts"
  }
}
```

### 方案 B：项目级配置

如果不想全局设置，可以在 `package.json` 中配置：

```json
{
  "scripts": {
    "start": "NODE_EXTRA_CA_CERTS=$HOME/.ssl/ca-certs.pem tsx src/index.ts"
  }
}
```

### 方案 C：禁用证书验证（不推荐）

```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

> **警告**：这会禁用所有 TLS 证书验证，存在安全风险，仅用于调试。

## 常见问题

### Q: 为什么 curl 可以工作但 Node.js 不行？

curl 使用系统证书存储，而 Node.js 有自己的证书处理机制。

### Q: 为什么 Bun 可以工作但 tsx/Node.js 不行？

Bun 使用系统原生的 TLS 实现（macOS 上是 Security.framework），而 Node.js 使用 OpenSSL。

### Q: 证书需要更新吗？

当系统更新根证书时，建议重新运行导出命令：

```bash
security find-certificate -a -p /System/Library/Keychains/SystemRootCertificates.keychain > ~/.ssl/ca-certs.pem
```

## 相关链接

- [Node.js TLS 文档](https://nodejs.org/api/tls.html#tlscreatesecurecontextoptions)
- [NODE_EXTRA_CA_CERTS 环境变量](https://nodejs.org/api/cli.html#node_extra_ca_certsfile)
