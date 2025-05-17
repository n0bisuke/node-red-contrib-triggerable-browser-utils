/**
 * Copyright 2013, 2016, 2018, 2021 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function (RED) {

  function TriggerableFileInjectNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    
    // ノード設定を保存
    this.name = config.name;
    this.filename = config.filename || "";
    this.mimetype = config.mimetype || "application/octet-stream";
    this.filedata = null;
    
    // Base64エンコードされたファイルデータをデコード
    if (config.filedata) {
      try {
        this.filedata = Buffer.from(config.filedata, 'base64');
        node.status({fill:"green", shape:"dot", text:"ファイル準備完了: " + this.filename});
      } catch (e) {
        node.error("ファイルデータのデコードエラー: " + e.toString());
        node.status({fill:"red", shape:"ring", text:"ファイルデータエラー"});
      }
    } else {
      node.status({fill:"grey", shape:"ring", text:"ファイル未設定"});
    }

    // ノード設定用のファイルアップロードエンドポイント
    RED.httpAdmin.post('/node-red-triggerable-fileinject/upload/:id', function(req, res) {
      var nodeId = req.params.id;
      
      if (nodeId) {
        // データを格納する配列
        var chunks = [];
        var dataLength = 0;
        
        // データチャンクを受信したときの処理
        req.on('data', function(chunk) {
          chunks.push(chunk);
          dataLength += chunk.length;
        });
        
        // データ受信が完了したときの処理
        req.on('end', function() {
          try {
            // すべてのチャンクを結合して1つのバッファにする
            var buffer = Buffer.concat(chunks, dataLength);
            
            // ファイル名とMIMEタイプを取得
            var filename = req.headers["x-filename"] || "unknown.bin";
            var mimetype = req.headers["content-type"] || "application/octet-stream";
            
            // Base64エンコードしたデータを返す
            res.json({
              status: "ok",
              filename: filename,
              mimetype: mimetype,
              filedata: buffer.toString('base64')
            });
          } catch(err) {
            res.status(500).json({
              status: "error",
              message: "ファイルアップロードエラー: " + err.toString()
            });
          }
        });
        
        // エラーが発生した場合の処理
        req.on('error', function(err) {
          res.status(500).json({
            status: "error",
            message: "ファイル受信エラー: " + err.toString()
          });
        });
      } else {
        res.status(404).json({
          status: "error",
          message: "no node id specified"
        });
      }
    });

    // ファイル送信関数
    function sendFile() {
      if (node.filedata) {
        // 保存されたファイルデータを送信
        node.status({fill:"green", shape:"dot", text:"送信中: " + node.filename});
        
        node.send({
          payload: node.filedata,
          filename: node.filename,
          mimetype: node.mimetype
        });
        
        setTimeout(function() {
          node.status({fill:"green", shape:"dot", text:"ファイル準備完了: " + node.filename});
        }, 1000);
      } else {
        node.warn("ファイルが設定されていません");
        node.status({fill:"red", shape:"ring", text:"ファイル未設定"});
      }
    }

    // 入力メッセージを受け取ったときの処理
    this.on('input', function(msg) {
      // 入力を受け取ったらファイルを送信
      sendFile();
    });

    // ノードが削除されたときのクリーンアップ
    this.on('close', function() {
      // 特に何もしない
    });
  }
  
  RED.nodes.registerType('triggerable-fileinject', TriggerableFileInjectNode);
};