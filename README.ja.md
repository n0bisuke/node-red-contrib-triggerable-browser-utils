# node-red-contrib-triggerable-browser-utils

[English version is here](README.md)

[Node-RED](http://nodered.org) 向けの、ファイルアップロード・カメラ・マイクなどのブラウザ機能を提供するノード  
**ノードのボタンだけでなく、InjectノードやFunctionノードなどからのトリガーにも対応しています。**

<img src="./torigara.png" width="200px">

> triggerable トリガラ

---

## このプロジェクトについて

このリポジトリは [node-red-contrib-browser-utils](https://github.com/node-red-contrib-utils/node-red-contrib-browser-utils) のフォークです。  
元の「ボタンのみでトリガー可能」という設計に加え、**InjectノードやFunctionノード、あるいは他の上流ノードからもカメラ・マイク・ファイルアップロードのノードをトリガー可能**にしました。

---

## インストール方法

Node-RED のルートディレクトリで以下のコマンドを実行してください：

```sh
npm install node-red-contrib-triggerable-browser-utils
```

または、Node-RED のパレットマネージャを使用して：

1. Node-RED メニューを開く
2. 「パレットの管理」を選択
3. 「インストール」タブをクリック
4. "triggerable-browser-utils" を検索
5. インストールをクリック

---

## 使い方

### トリガー可能カメラノード（`trig camera`）

カメラノードでは、接続されたカメラやWebカメラから画像をキャプチャできます。

**主な機能:**
- Injectノードやボタンからの画像キャプチャが可能
- 複数カメラがある場合は特定のカメラを選択可能
- 出力形式は Buffer または Base64 文字列を選択可
- 一定間隔での連続キャプチャ機能あり
- ChromeおよびFirefoxに対応

**設定項目:**
- **Name**: ノード名を任意に設定
- **Interval (ms)**: 連続モード時のキャプチャ間隔（デフォルト: 2000ms）
- **Camera**: 使用するカメラを選択
- **Output Format**: 出力形式（Buffer（デフォルト）またはBase64）

**出力:**
- `msg.payload`: PNG形式の画像（BufferまたはBase64）
- `msg.content_type`: 'image/png'
- `msg.format`: 'buffer' または 'base64'
- `msg.timestamp`: キャプチャ時刻

**メッセージによる制御:**
```javascript
// シンプルなトリガー
msg.payload = {};

// 明示的なコマンド
msg.payload = { command: "capture" }; // 1枚キャプチャ
msg.payload = { command: "start" };   // カメラ開始
msg.payload = { command: "stop" };    // カメラ停止
msg.payload = { command: "loop", interval: 5000 }; // 5秒間隔で連続キャプチャ
```

---

### トリガー可能マイクノード（`trig microphone`）

マイクノードでは、接続されたマイクから音声を録音できます。

**主な機能:**
- Injectノードやボタンから録音開始／停止が可能
- トグル動作：最初のトリガーで録音開始、次で停止
- 複数マイクがある場合は特定のマイクを選択可
- ChromeおよびFirefoxに対応（HTTPSが必要）

**設定項目:**
- **Name**: ノード名
- **Microphone**: 使用するマイクを選択

**出力:**
- `msg.payload`: 録音されたWAV形式の音声データ（Buffer）
- `msg.content_type`: 'audio/wav'
- `msg.timestamp`: 録音時刻

**メッセージによる制御:**
```javascript
// トグル（録音開始／停止）
msg.payload = {};

// 明示的なコマンド
msg.payload = { command: "start" }; // 録音開始
msg.payload = { command: "stop" };  // 録音停止して出力
```

---

### トリガー可能ファイルインジェクトノード（`trig file inject`）

ファイルインジェクトノードでは、ブラウザからNode-REDフローにファイルをアップロードできます。

**主な機能:**
- 2つの動作モードあり：
  1. あらかじめ設定されたファイルを使用
  2. 実行時にファイル選択ダイアログを表示
- Injectノードやボタンからのトリガーでファイル送信

**設定項目:**
- **Name**: ノード名
- **File**: ノードに格納するファイルをアップロード（事前設定モード）

**出力:**
- `msg.payload`: ファイルデータ（Buffer）
- `msg.filename`: 元のファイル名
- `msg.mimetype`: MIMEタイプ

**メッセージによる制御:**
```javascript
// 設定済みファイルを送信
msg.payload = {}; // 手動選択なしで送信可能
```

---

## ブラウザ互換性と要件

- **HTTPSが必要**: カメラやマイクアクセスにはセキュアな接続（HTTPS）が必要
- **対応ブラウザ**: Chrome, Firefox などのモダンブラウザ
- **アクセス許可**: ユーザーがカメラ・マイクへのアクセスを許可する必要あり
- **ダッシュボード使用**: Node-REDダッシュボードと組み合わせると便利

---

## 技術的な詳細

### カメラノード

- `navigator.mediaDevices.getUserMedia()` を使用してカメラにアクセス
- videoフレームをcanvasに描画して画像を取得
- canvas.toBlob() を用いてPNG形式に変換
- HTTP POSTを使ってNode-REDに画像送信

### マイクノード

- Web Audio APIを使用して音声を録音
- 録音結果はWAV形式
- 録音時間はブラウザのメモリに依存

### ファイルインジェクトノード

- HTML5 の `<input type="file">` を使用
- 設定済みファイルはBase64形式で保存

---

## 使用上のヒント

1. **ダッシュボードと併用**: ユーザーとの対話が必要なアプリケーションに最適
2. **エラーハンドリング**: 権限拒否などに備えた処理を忘れずに
3. **複数インスタンス**: 異なるデバイスごとにノードを複数使ってもOK
4. **セキュリティ意識**: ブラウザ操作は常にユーザーの許可が必要
5. **処理チェーン**: 画像・音声の後続処理ノードと連携して活用

---

## オリジナル版との違い

- **フロートリガー対応**: ノードのボタンだけでなくInject・Functionノードなどからもトリガー可能
- **デバイス選択**: カメラ・マイクを個別に選択できるようになった
- **出力形式の選択**: カメラノードでBufferまたはBase64が選べる
- **ファイルの事前設定**: 自動ワークフローに便利なファイル事前保存機能あり

---

## 貢献とライセンス

プルリクエストやバグ報告を歓迎します。  
このプロジェクトは [Apache 2.0 ライセンス](https://www.apache.org/licenses/LICENSE-2.0) の下で提供されています。

このリポジトリは [IBM Corp.](https://github.com/node-red-contrib-utils/node-red-contrib-browser-utils) による node-red-contrib-browser-utils に基づいており、  
Nobisuke Sugawara によって拡張・改良されています。

---