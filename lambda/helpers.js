module.exports = {
    medReminder: function (currentDateTime, newDateTime, freqStr, userTimeZone, medication, msgSSML) {
        return { requestTime : currentDateTime.format('YYYY-MM-DDTHH:mm:ss'),
            trigger: {
                type : 'SCHEDULED_ABSOLUTE',
                scheduledTime : newDateTime.format('YYYY-MM-DDTHH:mm:ss'),
                timeZoneId : userTimeZone,
                recurrence : {
                    startDateTime: newDateTime.format('YYYY-MM-DDTHH:mm:ss'),
                    recurrenceRules : freqStr
                    }
               },
            alertInfo: {
                spokenInfo: {
                    content: [{
                        locale: "en-US", 
                        text: `It's time to take ${medication}. Please notify me when you've taken your ${medication}.`,
                        ssml: msgSSML
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
      } else {
        minutes = m;
      }
      console.log("minutes", minutes);
      var spTime = hours + ":" + minutes + " " + ap;
      return spTime;
    },
    dowConversion: function (dow) {
        if (dow === 'Monday' || dow === 'monday' || dow === 1) {
            return { string : "MO",
                num : 1, 
                full : "Monday",
            }
        } else if (dow === 'Tuesday' || dow === 'tuesday' || dow === 2) {
            return { string : "TU",
                num : 2, 
                full : "Tuesday",
            }
        } else if (dow === 'Wednesday' || dow === 'wednesday' || dow === 3) {
            return { string : "WE",
                num : 3, 
                full : "Wednesday",
            }
        } else if (dow === 'Thursday' || dow === 'thursday' || dow === 4) {
            return { string : "TH",
                num : 4, 
                full : "Thursday",
            }
        } else if (dow === 'Friday' || dow === 'friday' || dow === 5) {
            return { string : "FR",
                num : 5, 
                full : "Friday",
            }
        } else if (dow === 'Saturday' || dow === 'saturday' || dow === 6) {
            return { string : "SA",
                num : 6, 
                full : "Saturday",
            }
        } else if (dow === 'Sunday' || dow === 'sunday' || dow === 0) {
            return { string : "SU",
                num : 0, 
                full : "Sunday",
            }
        } else {
            return { string : "DA", 
                num : 7,
                full : "Daily"
            }
        }
    }
}