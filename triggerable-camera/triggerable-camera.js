/**
 * Copyright 2013, 2016 IBM Corp.
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

  function CameraLoopNode (config) {
    RED.nodes.createNode(this, config);
    var node = this;
    
    // Configuration
    this.interval = config.interval || 2000;
    this.deviceId = config.deviceId || ""; // カメラデバイスID設定
    this.outputFormat = config.outputFormat || "buffer"; // 出力フォーマット設定（デフォルトはbuffer）

    RED.httpAdmin.get('/node-red-triggerable-camera/status', function (req, res) {
      var n = RED.nodes.getNode(req.query.id);
      var status = {};
      
      if ('true' == req.query.status) {
        status = {fill:'green', shape:'dot', text: req.query.text || 'active'};
      } else {
        status = {};
      }
      
      if (n) {
        n.status(status);
      }
      res.json({});
    });

    // body-parserを使わずに画像データを受信する処理
    RED.httpAdmin.post('/node-red-triggerable-camera/:id', function(req, res) {
      var node = RED.nodes.getNode(req.params.id);
      
      if (node != null) {
        try {
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
              
              node.log("画像データを受信しました: " + buffer.length + " bytes");
              
              // 出力フォーマットを取得（ヘッダーまたはノード設定から）
              var outputFormat = req.headers["x-output-format"] || node.outputFormat || "buffer";
              
              // メッセージオブジェクトを作成
              var msg = {
                content_type: 'image/png',
                timestamp: new Date().getTime()
              };
              
              // 選択されたフォーマットに応じてpayloadを設定
              if (outputFormat === "base64") {
                // Base64形式で送信
                msg.payload = buffer.toString('base64');
                msg.format = "base64";
              } else {
                // バッファーのまま送信
                msg.payload = buffer;
                msg.format = "buffer";
              }
              
              // ノードの出力にデータを送信
              node.send(msg);
              
              node.status({});
              res.sendStatus(200);
            } catch(err) {
              node.status({fill:'red', shape:'dot', text:'データ処理エラー'});
              node.error("画像データ処理エラー: " + err.toString());
              res.sendStatus(500);
            }
          });
          
          // エラーが発生した場合の処理
          req.on('error', function(err) {
            node.status({fill:'red', shape:'dot', text:'受信エラー'});
            node.error("画像受信エラー: " + err.toString());
            res.sendStatus(500);
          });
          
        } catch(err) {
          node.status({fill:'red', shape:'dot', text:'処理エラー'});
          node.error("リクエスト処理エラー: " + err.toString());
          res.sendStatus(500);
        }
      } else {
        res.status(404).send("no node found");
      }
    });

    // カメラを起動する関数
    function activateCamera() {
      node.log("カメラ起動コマンドを送信します");
      // フロントエンドにカメラ起動のコマンドを送信（デバイスIDも含める）
      RED.comms.publish("triggerable-camera", {
        id: node.id,
        command: 'capture',
        deviceId: node.deviceId // デバイスIDを送信
      });
      
      // ステータスを更新
      node.status({fill:'green', shape:'dot', text:'camera active'});
    }

    this.on('input', function (msg) {
      // どんなペイロードが来ても、まずはカメラを起動
      node.log("入力を受信しました: " + JSON.stringify(msg));
      
      // コマンドが含まれる場合は特別処理
      if (msg.payload && typeof msg.payload === 'object' && msg.payload.command) {
        var command = msg.payload.command;
        var interval = msg.payload.interval || node.interval;
        
        RED.comms.publish("triggerable-camera", {
          id: node.id,
          command: command,
          interval: interval,
          deviceId: node.deviceId // デバイスIDを送信
        });
        
        if (command === 'stop') {
          node.status({});
        }
      } else {
        // それ以外の入力はすべてキャプチャコマンドとして扱う
        activateCamera();
      }
    });

    // Cleanup when node is removed or redeployed
    this.on('close', function() {
      node.log("ノードを閉じます");
      RED.comms.publish("triggerable-camera", {
        id: node.id,
        command: 'stop'
      });
    });
  }
  
  RED.nodes.registerType('triggerable-camera', CameraLoopNode);
};