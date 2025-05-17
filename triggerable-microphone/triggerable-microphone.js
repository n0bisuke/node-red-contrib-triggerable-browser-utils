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
  var requestSize = '50mb';
  var requestType = 'audio/wav';

  const MICSTATUS = {
      OFF : '1',
      ON  : '2',
      CONTEXTERROR : '4'
  };

  function TriggerableMicrophoneNode (config) {
    RED.nodes.createNode(this, config);
    var node = this;
    
    // 設定の保存
    this.name = config.name;
    this.deviceId = config.deviceId || '';
    
    // マイクの状態を記録
    this.isRecording = false;

    RED.httpAdmin.get('/node-red-triggerable-microphone/status', function (req, res) {
      var n = RED.nodes.getNode(req.query.id);
      var status = {};
      switch(req.query.status) {
      case MICSTATUS.ON :
          status = {fill:'red', shape:'dot', text:'recording...'};
          break;
      case MICSTATUS.CONTEXTERROR :
          status = {fill:'red', shape:'dot', text:'error resuming audio context'};
          break;
      }
      if (n) {
        n.status(status);
      }
      res.json({});
    });

    // body-parserを使わずに音声データを受信する処理
    RED.httpAdmin.post('/node-red-triggerable-microphone/:id', function(req, res) {
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
              
              node.log("音声データを受信しました: " + buffer.length + " bytes");
              
              // ペイロードとして音声データを送信
              node.send({
                payload: buffer,
                content_type: 'audio/wav',
                timestamp: new Date().getTime()
              });
              
              node.status({});
              res.sendStatus(200);
            } catch(err) {
              node.status({fill:'red', shape:'dot', text:'データ処理エラー'});
              node.error("音声データ処理エラー: " + err.toString());
              res.sendStatus(500);
            }
          });
          
          // エラーが発生した場合の処理
          req.on('error', function(err) {
            node.status({fill:'red', shape:'dot', text:'受信エラー'});
            node.error("音声受信エラー: " + err.toString());
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

    // マイク録音の開始
    function startRecording() {
      node.log("マイク録音開始コマンドを送信します");
      node.isRecording = true;
      
      // フロントエンドにマイク起動のコマンドを送信
      RED.comms.publish("triggerable-microphone", {
        id: node.id,
        command: 'start',
        deviceId: node.deviceId // デバイスIDを送信
      });
      
      // ステータスを更新
      node.status({fill:'red', shape:'dot', text:'recording...'});
    }
    
    // マイク録音の停止
    function stopRecording() {
      node.log("マイク録音停止コマンドを送信します");
      node.isRecording = false;
      
      // フロントエンドにマイク停止コマンドを送信
      RED.comms.publish("triggerable-microphone", {
        id: node.id,
        command: 'stop'
      });
      
      // ステータスを更新
      node.status({});
    }

    this.on('input', function (msg) {
      node.log("入力を受信しました: " + JSON.stringify(msg));
      
      // コマンドが含まれる場合は特別処理
      if (msg.payload && typeof msg.payload === 'object' && msg.payload.command) {
        if (msg.payload.command === 'start') {
          startRecording();
        } else if (msg.payload.command === 'stop') {
          stopRecording();
        }
      } else {
        // それ以外の入力はトグルするように扱う
        if (node.isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      }
    });

    // Cleanup when node is removed or redeployed
    this.on('close', function() {
      node.log("ノードを閉じます");
      if (node.isRecording) {
        RED.comms.publish("triggerable-microphone", {
          id: node.id,
          command: 'stop'
        });
      }
    });
  }
  
  RED.nodes.registerType('triggerable-microphone', TriggerableMicrophoneNode);

  RED.httpAdmin.get('/triggerable-microphone/js/*', function(req, res){
    var options = {
        root: __dirname + '/static/',
        dotfiles: 'deny'
    };

    res.sendFile(req.params[0], options);
  });
};