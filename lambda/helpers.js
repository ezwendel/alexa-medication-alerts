module.exports = {
    medReminder: function (currentDateTime, newDateTime, freqStr, userTimeZone, medication) {
        return { requestTime : currentDateTime.format('YYYY-MM-DDTHH:mm:ss'),
            trigger: {
                type : 'SCHEDULED_ABSOLUTE',
                scheduledTime : newDateTime.format('YYYY-MM-DDTHH:mm:ss'),
                timeZoneId : userTimeZone,
                recurrence : {                        
                    recurrenceRules : [ freqStr ]
                    }
               },
            alertInfo: {
                spokenInfo: {
                    content: [{
                        locale: "en-US", 
                        text: `It's time to take ${medication}.`,  
                    }]
                }
            },
            pushNotification : {                            
               status : 'ENABLED'
            }
        }
    },
    sayTime: function (time) {
      var h = time.substr(0, 2)*1;
      var m = time.substr(3, 2);
      var ap
      var minutes
      var hours
      if (h<12) {
        ap = "A. M."
      } else {
        ap = "P. M."
      }
      if (h*1===0) {
        hours = "12";
      } else if (h>12) {
        hours = h-12;
      } else {
        hours = h*1;
      }
      if (m*1===0) {
        minutes = ""
      } else if (m*1<10) {
        minutes = m*1
      } else {
        minutes = m;
      }
      var spTime = hours + " " + minutes + " " + ap;
      return spTime;
    }
}