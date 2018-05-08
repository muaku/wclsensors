// const Microwave = require("./microwave/Microwave").Microwave
const SerialPort = require('serialport');
const bsplit = require('buffer-split')
const moment = require("moment")
const CronJob = require('cron').CronJob;
const ably = require("ably")
const client = ably.Realtime('Q94B2g.aOcNMg:c_XnWwWEgIlZmO8f');
var channel = client.channels.get('test')

// var microwave = new Microwave("/dev/tty.usbserial-AL00AWMB", "/dev/ttyUSB0")
// microwave.start()

/**
 *  Ably realtime
 */
client.connection.on("connected", () => {
    console.log("successful connection")
})

channel.publish('initFromClient', 'client connection の確認');

/* Subscribe to Heroku cloud server */
channel.subscribe('initFromServer', function(message) {
    console.log("Heroku cloud server msg: ", message.data)
})


/**
 * microwave sensor
 */

/* DEFINE */
const PRE = Buffer.from([0x80, 0x00, 0x80, 0x00,0x80, 0x00,0x80, 0x00]);
const TYPE1 = {
  VAL: 1,
  LEN: 18,
  DATA_LEN: 6,
  /* INDEX AFTER REMOVING 'PRE' BUFFER */
  HEART: {
    FROM_INDEX: 2,
    TO_INDEX: 4
  },
  BREATH: {
    FROM_INDEX: 4,
    TO_INDEX: 6
  } 
}
const TYPE2 = {
  VAL: 2,
  LEN: 14,
  DATA_LEN: 2,
  /* INDEX AFTER REMOVING 'PRE' BUFFER */
  DATA_START_INDEX: 2,
  DATA_END_INDEX: 3
}
const TYPE3 = {
  VAL: 3,
  LEN: 14,
  DATA_LEN: 2,
  /* INDEX AFTER REMOVING 'PRE' BUFFER */
  DATA_START_INDEX: 2,
  DATA_END_INDEX: 3
}
const TYPE9 = {
  VAL: 9,
  LEN: 14,
  DATA_LEN: 2,
  /* INDEX AFTER REMOVING 'PRE' BUFFER */
  DATA_START_INDEX: 2,
  DATA_END_INDEX: 4
}
const TYPE10 = {
  VAL: 10,
  LEN: 14,
  DATA_LEN: 2,
  /* INDEX AFTER REMOVING 'PRE' BUFFER */
  DATA_START_INDEX: 2,
  DATA_END_INDEX: 4
}

 /* DATA TO PASS TO Fluentd */
var DATA_TO_SEND = {}


/* OPEN PORT ON MAC OR RASPI */
const portNumber = (process.platform == "darwin") ? "/dev/tty.usbserial-AL00AWMB" : '/dev/ttyUSB0'
const port = new SerialPort(portNumber, {
  baudRate: 115200
}, function(err) {
  if(err) {
    throw new Error(err.message)
  }
})

/* READ data */
var buffer = Buffer.from([])
var lenToDelete = 0
port.on("data", function(chunk) {
  buffer = Buffer.concat([buffer, chunk])
  var datas = bsplit(buffer,PRE)
  var datas_len = datas.length 
  // datas[0] is empty 
  if(datas_len > 2) {
    lenToDelete = 0
    for (i=1; i<= datas_len-2; i++) { // first&last elementを含まない
      var type = datas[i].readUIntBE(0,1) // GET type
      extractData(type, datas[i]) // should use child process
      /* bufferの利用した分を消す */
      if(i===datas_len-2) {
        buffer = buffer.slice(lenToDelete)
      }
    }
  }
})

/* EXTRACT data */
const extractData = function(type, data) {
   switch(type) {
     case 1:
      lenToDelete += TYPE1.LEN
      break
     case 2:
      lenToDelete += TYPE2.LEN
      var heart = data.readUIntBE(TYPE2.DATA_START_INDEX, 1)  // Read 1 byte
      DATA_TO_SEND["heart"] = heart
      // fluentd.emit("heart", {"heart": heart})
    //   console.log('data to fluentd HEART: ', heart)
      break
     case 3:
      lenToDelete += TYPE3.LEN
      var breath = data.readUIntBE(TYPE3.DATA_START_INDEX, 1)
      DATA_TO_SEND["breath"] = breath
      // fluentd.emit("breath", {"breath": breath})
    //   console.log('data to fluentd BREATH: ', breath)
      break
     case 9:
        lenToDelete += TYPE9.LEN
      break
     case 10:
      lenToDelete += TYPE10.LEN
      var motion = data.readInt16BE(TYPE3.DATA_START_INDEX, 2)
      DATA_TO_SEND["motion"] = motion
    //   console.log('motion:', motion)  
      break
     default:
        console.log("TYPE is out of range")
   }
}

/* RUN EVERY 5 SEC */
var Job = new CronJob('*/5 * * * * *', function() {
  DATA_TO_SEND["time"]= moment().format()
  console.log("DATA_TO_SEND: ", DATA_TO_SEND)
  channel.publish('microwave', DATA_TO_SEND);
  console.log("*----------------------------------------------* ")
}).start()
