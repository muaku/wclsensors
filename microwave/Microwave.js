const SerialPort = require('serialport');
const bsplit = require('buffer-split')

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

/*
 * HOW TO USE
 * new Microwave("mac_serialPort", "raspi_serialPort")
 */

class Microwave {
    
    constructor(mac_serialPort, raspi_serialPort) {
        if (typeof(mac_serialPort) !== 'string' || typeof(raspi_serialPort) !== 'string') {
            throw ("port should be a string")
        }
        /* OPEN PORT FOR MAC OR RASPI */
        this._mac_serialPort = (mac_serialPort !== "") ? mac_serialPort : "/dev/tty.usbserial-AL00AWMB"
        this._raspi_serialPort = (raspi_serialPort !== "") ? raspi_serialPort : "/dev/ttyUSB0"
        this._portNumber = (process.platform == "darwin") ? this._mac_serialPort : this._raspi_serialPort
        this._port = new SerialPort(this._portNumber, {
                baudRate: 115200
            }, function(err) {
            if(err) {
                return new Error(err.message)
            }
        })
        this._microwaveData = {     /* microwave data to send cloud server */
            "heart": null,
            "breath": null,
            "motion": null,
            "time": null
        }      
    }

    

    start() {
        /* READ data */
        var lenToDelete = 0
        var buffer = Buffer.from([])
        this._port.on("data", function(chunk) {
            buffer = Buffer.concat([buffer, chunk])
            var datas = bsplit(buffer,PRE)
            var datas_len = datas.length 
            console.log(buffer)
            // datas[0] is empty 
            if(datas_len > 2) {
                lenToDelete = 0
                var i
                for (i=1; i<= datas_len-2; i++) { // first&last elementを含まない
                    var type = datas[i].readUIntBE(0,1) // GET type
                    // extractData(parseInt(type), datas[i]) 
                    var data = datas[i]
                    switch(type) {
                        case 1:
                            lenToDelete += TYPE1.LEN
                            break
                        case 2:
                            lenToDelete += TYPE2.LEN
                            var heart = data.readUIntBE(TYPE2.DATA_START_INDEX, 1)  // Read 1 byte
                            this._microwaveData["heart"] = heart
                            // fluentd.emit("heart", {"heart": heart})
                            console.log('HEART: ', heart)
                            break
                        case 3:
                            lenToDelete += TYPE3.LEN
                            var breath = data.readUIntBE(TYPE3.DATA_START_INDEX, 1)
                            this._microwaveData["breath"] = breath
                            // fluentd.emit("breath", {"breath": breath})
                            console.log('BREATH: ', breath)
                            break
                        case 9:
                            lenToDelete += TYPE9.LEN
                            break
                        case 10:
                            lenToDelete += TYPE10.LEN
                            var motion = data.readInt16BE(TYPE3.DATA_START_INDEX, 2)
                            this._microwaveData["motion"] = motion
                            console.log('motion:', motion)  
                            break
                        default:
                            console.log("TYPE is out of range")
                    }

                    /* bufferの利用した分を消す */
                    if(i===datas_len-2) {
                        buffer = buffer.slice(lenToDelete)
                    }
                }
            }
        })

        /* EXTRACT data */
        var extractData = (type, data) => {
            console.log("inside extractData")
            
        }
    }

    getData() {
        this._microwaveData["time"] = Date.now()    /* Attach time */
        return this._microwaveData
    }
}

exports.Microwave = Microwave










