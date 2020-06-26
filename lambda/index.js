// This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const Alexa = require('ask-sdk-core');
const persistenceAdapter = require('ask-sdk-s3-persistence-adapter');
const moment = require('moment-timezone');
const helpers = require('./helpers.js');

const HasAlertsLaunchRequestHandler = {
    canHandle(handlerInput) {
        
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
        
        let medicationList = sessionAttributes.hasOwnProperty('medication') ? sessionAttributes.medication : 0;
        let timeList = sessionAttributes.hasOwnProperty('time') ? sessionAttributes.time : 0;
        let weekdayList = sessionAttributes.hasOwnProperty('weekday') ? sessionAttributes.weekday : 0;
        let reminderIdList = sessionAttributes.hasOwnProperty('reminderId') ? sessionAttributes.reminderId : 0;
        
        
        return medicationList && timeList && weekdayList && reminderIdList && Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        let speakOutput 
        
        const { permissions } = handlerInput.requestEnvelope.context.System.user;
        
        if (!permissions) {
            handlerInput.responseBuilder
            .speak("This skill needs permissions to access your reminders")
            .addDirective({
                type: "Connections.SendRequest",
                name: "AskFor",
                payload: {
                    "@type": "AskForPermissionsConsentRequest",
                    "@version": "1",
                    "permissionScope": "alexa::alerts:reminders:skill:readwrite"
                },
                token: ""
            });
        } else {
            const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient()
            const reminderList = await reminderApiClient.getReminders();
            
            const attributesManager = handlerInput.attributesManager;
            const sessionAttributes = attributesManager.getSessionAttributes() || {};
            
            let medicationList = sessionAttributes.hasOwnProperty('medication') ? sessionAttributes.medication : 0;
            let timeList = sessionAttributes.hasOwnProperty('time') ? sessionAttributes.time : 0;
            let weekdayList = sessionAttributes.hasOwnProperty('weekday') ? sessionAttributes.weekday : 0;
            let reminderIdList = sessionAttributes.hasOwnProperty('reminderId') ? sessionAttributes.reminderId : 0;
            
            if (reminderList.totalCount==='0' && reminderIdList.length>0) {
                reminderIdList = []
                medicationList = []
                timeList = []
                weekdayList = []
            } else if (reminderList.totalCount < reminderIdList.length) {
                let j
                let k
                for (j=reminderIdList.length-1; j>=0; j--) {
                    let temp = true
                    for (k=0; k<reminderList.totalCount;k++) {
                        if (reminderIdList[j]===reminderList.alerts[k].alertToken) {
                            temp = true
                            break
                        } else {
                            temp = false
                        }
                    }
                    if (temp === false) {
                        reminderIdList.splice(j,1)
                        medicationList.splice(j,1)
                        timeList.splice(j,1)
                        weekdayList.splice(j,1)
                    }
                } 
            }
            
            const medicationAttributes = {
                "medication" : medicationList,
                "time" : timeList,
                "weekday" : weekdayList,
                "reminderId" : reminderIdList
            };
            attributesManager.setPersistentAttributes(medicationAttributes);
            await attributesManager.savePersistentAttributes();
            
            if (medicationList.length === 0) {
                speakOutput = "Welcome back to Medication Alert. You do not have any medication alarms currently set."
            } else if (medicationList.length === 1) {
                speakOutput = `Welcome back to Medication Alert. The medication alarm you currently have set is `
            } else {
                speakOutput = `Welcome back to Medication Alert. The medication alarms you currently have set are `
            }
            let i
            console.log(weekdayList[0])
            for (i = 0; i < medicationList.length; i++) {
                if (i === medicationList.length - 1) {
                    if (weekdayList[i] === 'daily') {
                        speakOutput += `${medicationList[i]} daily at ${helpers.sayTime(timeList[i])}.`
                    } else {
                        speakOutput += `${medicationList[i]} every ${weekdayList[i]} at ${helpers.sayTime(timeList[i])}.`
                    }
                    break
                } else {
                    if (weekdayList[i] === 'daily') {
                        speakOutput += `${medicationList[i]} daily at ${helpers.sayTime(timeList[i])}`
                    } else {
                        speakOutput += `${medicationList[i]} every ${weekdayList[i]} at ${helpers.sayTime(timeList[i])}`
                    }
                }
                speakOutput += `, and `
            }
            
            speakOutput += ` You may add, edit, or remove alarms by telling me to do so, or you can exit if you are satisfied with the alarms.`
        }
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
    }
};

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const { permissions } = handlerInput.requestEnvelope.context.System.user;
        
        if (!permissions) {
            handlerInput.responseBuilder
            .speak("This skill needs permissions to access your reminders")
            .addDirective({
                type: "Connections.SendRequest",
                name: "AskFor",
                payload: {
                    "@type": "AskForPermissionsConsentRequest",
                    "@version": "1",
                    "permissionScope": "alexa::alerts:reminders:skill:readwrite"
                },
                token: ""
            });
        } else {
            handlerInput.responseBuilder
                .speak('Welcome to Medication Alert. Please tell us a medication and the time you need to take it.')
                .reprompt('Welcome to Medication Alert. Please tell us a medication and the time you need to take it.')
        }
        
        return handlerInput.responseBuilder
            .getResponse();
    }
};
const AddMedicationIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AddMedicationIntent';
    },
    async handle(handlerInput) {
        
        const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient(),
            { permissions } = handlerInput.requestEnvelope.context.System.user
        
        if (!permissions) {
            return handlerInput.responseBuilder
                .speak('Please go the the Alexa Mobile App to grant reminders to permissions.')
                .withAskForPermissionsConsentCard(['alexa::alerts:reminders:skill:readwrite'])
                .getResponse()
        }
        
        const medication = handlerInput.requestEnvelope.request.intent.slots.medication.value;
        const time = handlerInput.requestEnvelope.request.intent.slots.time.value;
        const weekday = handlerInput.requestEnvelope.request.intent.slots.weekday.value;
        
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
        
        // deviceId to get timezone
        const serviceClientFactory = handlerInput.serviceClientFactory;
        const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
        
        // getting timezone
        let userTimeZone;
        try {
            const upsServiceClient = handlerInput.serviceClientFactory.getUpsServiceClient();
            userTimeZone = await upsServiceClient.getSystemTimeZone(deviceId);    
        } catch (error) {
            if (error.name !== 'ServiceError') {
                return handlerInput.responseBuilder.speak("There was a problem connecting to the service.").getResponse();
            }
            console.log('error', error.message);
        }
        
        // getting current date from moment
        const currentDateTime = moment().tz(userTimeZone)
        var currDow = currentDateTime.day() 
        let scheduleDow = 0
        
        let weekdayString
        
        // getting dow from slot
        if (weekday === 'Monday') {
            scheduleDow = 1
            weekdayString = "MO"
        } else if (weekday === 'Tuesday') {
            scheduleDow = 2
            weekdayString = "TU"
        } else if (weekday === 'Wednesday') {
            scheduleDow = 3
            weekdayString = "WE"
        } else if (weekday === 'Thursday') {
            scheduleDow = 4
            weekdayString = "TH"
        } else if (weekday === 'friday') {
            scheduleDow = 5
            weekdayString = "FR"
        } else if (weekday === 'Saturday') {
            scheduleDow = 6
            weekdayString = "SA"
        } else if (weekday === 'Sunday') {
            scheduleDow = 7
            weekdayString = "SU"
        }
        
        // getting new date from current and scheduled dow
        var newDate = currentDateTime.date()
        if (currDow <= scheduleDow) {
            newDate += (scheduleDow - currDow)
        } else {
            newDate += (7 + scheduleDow - currDow)
        }
        
        // setting new date to correct time during day
        var reminderRequest;
        const hour = +(10* time[0]) + +(time[1]);
        const min = +(10* time[3]) + +(time[4]);
        const newDateTime = moment().tz(userTimeZone);
        newDateTime.set({
            hour: hour,
            minute: min,
            second: '00'
        })
        
        if (scheduleDow === 0) {
            let freqString = `FREQ=DAILY;BYHOUR=${hour};BYMINUTE=${min};BYSECOND=0`
            reminderRequest = helpers.medReminder(currentDateTime, newDateTime, freqString, userTimeZone, medication)
        } else { //scheduling weekly for a day of the week
            newDateTime.set({
                date: newDate
            })
            let freqString = `FREQ=WEEKLY;BYDAY=${weekdayString};BYHOUR=${hour};BYMINUTE=${min};BYSECOND=0`
            reminderRequest = helpers.medReminder(currentDateTime, newDateTime, freqString, userTimeZone, medication)
        }
        
        let reminderResponse
        
        try {
            reminderResponse = await reminderApiClient.createReminder(reminderRequest)
        }
        catch(error) {
            console.log(`~~~ Error: ${error}`)
            return handlerInput.responseBuilder
                .speak('There was an error making the reminder. Please try again later.')
                .getResponse();
        }
        
        const reminderId = reminderResponse.alertToken
        
        let medicationList = sessionAttributes.hasOwnProperty('medication') ? sessionAttributes.medication : 0;
        let timeList = sessionAttributes.hasOwnProperty('time') ? sessionAttributes.time : 0;
        let weekdayList = sessionAttributes.hasOwnProperty('weekday') ? sessionAttributes.weekday : 0;
        let reminderIdList = sessionAttributes.hasOwnProperty('reminderId') ? sessionAttributes.reminderId : 0;
        
        if (medicationList && timeList && weekdayList && reminderIdList) {
            medicationList.push(medication);
            timeList.push(time);
            weekdayList.push(weekday);
            reminderIdList.push(reminderId)
        } else {
            medicationList = [medication];
            timeList = [time];
            weekdayList = [weekday];
            reminderIdList = [reminderId];
        }
        
        const medicationAttributes = {
            "medication" : medicationList,
            "time" : timeList,
            "weekday" : weekdayList,
            "reminderId" : reminderIdList
        };
        attributesManager.setPersistentAttributes(medicationAttributes);
        await attributesManager.savePersistentAttributes();
        var i
        for (i=0; i<medicationList.length;i++) {
            console.log(timeList[i])
        }
        
        let speakOutput
        if (scheduleDow === 0) {
            speakOutput = `Thanks, we will remember that you need to take ${medication} at ${helpers.sayTime(time)} ${weekday}.`
        } else {
            speakOutput = `Thanks, we will remember that you need to take ${medication} at ${helpers.sayTime(time)} on ${weekday}.`
        }
        return handlerInput.responseBuilder
            .speak(speakOutput + ' Would you like to add another medication alert? If so, please give the medication and time you take it.')
            .reprompt("You may add, edit, or remove alarms by telling me to do so, or you can exit if you are satisfied with the alarms.")
            .getResponse();
    }
};

// const DeleteMedicationIntentHandler = {
//     canHandle(handlerInput) {
//         return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
//             && Alexa.getIntentName(handlerInput.requestEnvelope) === 'DeleteMedicationIntent';
//     },
//     async handle(handlerInput) {
        
//         const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient(),
//             { permissions } = handlerInput.requestEnvelope.context.System.user
        
//         if (!permissions) {
//             return handlerInput.responseBuilder
//                 .speak('Please go the the Alexa Mobile App to grant reminders to permissions.')
//                 .withAskForPermissionsConsentCard(['alexa::alerts:reminders:skill:readwrite'])
//                 .getResponse()
//         }
        
//         const attributesManager = handlerInput.attributesManager;
//         const sessionAttributes = attributesManager.getSessionAttributes() || {};
        
//         const medication = handlerInput.requestEnvelope.request.intent.slots.medication.value;
        
//         let medicationList = sessionAttributes.hasOwnProperty('medication') ? sessionAttributes.medication : 0;
//         let timeList = sessionAttributes.hasOwnProperty('time') ? sessionAttributes.time : 0;
//         let weekdayList = sessionAttributes.hasOwnProperty('weekday') ? sessionAttributes.weekday : 0;
//         let reminderIdList = sessionAttributes.hasOwnProperty('reminderId') ? sessionAttributes.reminderId : 0;
        
//         let medId = -1
        
//         let i
//         for (i = 0; i < medicationList.length; i++) {
//             if (medicationList[i] === medication) {
//                 medId = i
//                 break
//             }
//         }
        
//         if (medId === -1) {
//             return handlerInput.responseBuilder
//                 .speak(`${medication} was not one of the medications we had an alarm for. Please give the name of the alert you wish to delete or exit out.`)
//                 .getResponse();
//         }
        
//         const timeDel = timeList[medId]
//         const weekdayDel = weekdayList[medId]
        
//         try {
//             await reminderApiClient.deleteReminder(reminderIdList[medId])
//         } catch(error) {
//             console.log(`${error}`)
//             return handlerInput.responseBuilder
//                 .speak(`There was an issue deleting the reminder for ${medication}. Please try again later.`)
//                 .getResponse();
//         }
        
//         medicationList.splice(medId, 1)
//         timeList.splice(medId, 1)
//         weekdayList.splice(medId, 1)
//         reminderIdList.splice(medId, 1)
        
//         const medicationAttributes = {
//             "medication" : medicationList,
//             "time" : timeList,
//             "weekday" : weekdayList,
//             "reminderId" : reminderIdList
//         };
        
//         attributesManager.setPersistentAttributes(medicationAttributes);
//         await attributesManager.savePersistentAttributes();
        
//         let speakOutput
//         if (weekdayList[medId] === 'Daily') {
//             speakOutput = `The daily alarm for ${medication} at ${helpers.sayTime(timeDel)} has been successfully deleted.`
//         } else {
//             speakOutput = `The weekly alarm for ${medication} at ${helpers.sayTime(timeDel)} on ${weekdayDel} has been successfully deleted.`
//         }
        
//         return handlerInput.responseBuilder
//             .speak(speakOutput+ ' Would you like to delete another medication alert? If so, please give the name of the medication')
//             .reprompt('You may add, edit, or remove alarms by telling me to do so, or you can exit if you are satisfied with the alarms.')
//             .getResponse();
//     }
// };

const DeleteMedicationIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'DeleteMedicationIntent';
    },
    async handle(handlerInput) {
        const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient(),
            { permissions } = handlerInput.requestEnvelope.context.System.user
        
        if (!permissions) {
            return handlerInput.responseBuilder
                .speak('Please go the the Alexa Mobile App to grant reminders to permissions.')
                .withAskForPermissionsConsentCard(['alexa::alerts:reminders:skill:readwrite'])
                .getResponse()
        }
        
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
        
        const medication = handlerInput.requestEnvelope.request.intent.slots.medication.value;
        let time = handlerInput.requestEnvelope.request.intent.slots.time.value;
        let weekday = handlerInput.requestEnvelope.request.intent.slots.weekday.value;
        
        let medicationList = sessionAttributes.hasOwnProperty('medication') ? sessionAttributes.medication : 0;
        let timeList = sessionAttributes.hasOwnProperty('time') ? sessionAttributes.time : 0;
        let weekdayList = sessionAttributes.hasOwnProperty('weekday') ? sessionAttributes.weekday : 0;
        let reminderIdList = sessionAttributes.hasOwnProperty('reminderId') ? sessionAttributes.reminderId : 0;
        
        let medId = -1
        
        let i
        let count = 0
        for (i = 0; i < medicationList.length; i++) {
            if (medicationList[i] === medication) {
                if (!time && !weekday) {
                    medId = i
                    time = timeList[i]
                    weekday = weekdayList[i]
                    break
                } else if (!time) {
                    if (weekday === weekdayList[i]) {
                        medId = i
                        time = timeList[i]
                        break
                    }
                } else if (!weekday) {
                    if (time === timeList[i]) {
                        medId = i
                        weekday = weekdayList[i]
                        break
                    }
                } else {
                    if (time === timeList[i] && weekday === weekdayList[i]) {
                        medId = i
                        break
                    }
                }
                count++
            }
        }
        
        // if (count > 1) {
        //     let medIds = []
        //     let medIdString = `There are ${count} alarms for ${medication}. They are `
        //     let j
        //     for (j = 0; j < medicationList.length; j++) {
        //         if (medicationList[j] === medication) {
        //             medIds.push(j)
        //             if (weekdayList[j] === 'Daily') {
        //                 if (j === medId) {
        //                     medIdString += `and daily at ${timeList[j]}.`
        //                     break
        //                 }
        //                 medIdString += `daily at ${timeList[j]}`
        //             } else {
        //                 if (j === medId) {
        //                     medIdString += `and ${weekdayList[j]}s at ${timeList[j]}.`
        //                     break
        //                 }
        //                 medIdString += `${weekdayList[j]}s at ${timeList[j]}`
        //             }
        //             medIdString += `, `
        //         }
        //     }
        //     medIdString += ` Please choose the time and day of the one you wish to delete.`
        //     handlerInput.responseBuilder
        //         .speak(medIdString)
        //     let timeAndDay = handlerInput.requestEnvelope.request.intent.slots
        //     let time = timeAndDay.time.value
        //     let weekday = timeAndDay.weekday.value
        //     let k
        //     for (k = 0; k < medIds.length; k++) {
        //         if (time === timeList[medIds[k]] && weekday === weekdayList[medIds[k]]) {
        //             medId = medIds[k]
        //         }
        //     }
        // }
        
        if (medId === -1) {
            return handlerInput.responseBuilder
                .speak(`We couldn't find the alarm you specified. Please say to delete the medication, time, and weekday of the alarm you wish to delete or exit out.`)
                .getResponse();
        }
        
        // const timeDel = timeList[medId]
        // const weekdayDel = weekdayList[medId]
        
        try {
            await reminderApiClient.deleteReminder(reminderIdList[medId])
        } catch(error) {
            console.log(`${error}`)
            return handlerInput.responseBuilder
                .speak(`There was an issue deleting the reminder for ${medication}. Please try again later.`)
                .getResponse();
        }
        
        medicationList.splice(medId, 1)
        timeList.splice(medId, 1)
        weekdayList.splice(medId, 1)
        reminderIdList.splice(medId, 1)
        
        const medicationAttributes = {
            "medication" : medicationList,
            "time" : timeList,
            "weekday" : weekdayList,
            "reminderId" : reminderIdList
        };
        
        attributesManager.setPersistentAttributes(medicationAttributes);
        await attributesManager.savePersistentAttributes();
        
        let speakOutput
        if (weekdayList[medId] === 'daily') {
            speakOutput = `The daily alarm for ${medication} at ${helpers.sayTime(time)} has been successfully deleted.`
        } else {
            speakOutput = `The weekly alarm for ${medication} at ${helpers.sayTime(time)} on ${weekday} has been successfully deleted.`
        }
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Would you like to add another medication alert? If so, please give the medication and time you take it.')
            .getResponse();
    }
};

// const UpdateMedicationIntentHandler = {
//     canHandle(handlerInput) {
//         return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
//             && Alexa.getIntentName(handlerInput.requestEnvelope) === 'UpdateMedicationIntent';
//     },
//     async handle(handlerInput) {
        
//         const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient(),
//             { permissions } = handlerInput.requestEnvelope.context.System.user
        
//         if (!permissions) {
//             return handlerInput.responseBuilder
//                 .speak('Please go the the Alexa Mobile App to grant reminders to permissions.')
//                 .withAskForPermissionsConsentCard(['alexa::alerts:reminders:skill:readwrite'])
//                 .getResponse()
//         }
        
//         const attributesManager = handlerInput.attributesManager;
//         const sessionAttributes = attributesManager.getSessionAttributes() || {};
        
//         const medication = handlerInput.requestEnvelope.request.intent.slots.medication.value;
//         const time = handlerInput.requestEnvelope.request.intent.slots.time.value;
//         const weekday = handlerInput.requestEnvelope.request.intent.slots.weekday.value;
        
//         let medicationList = sessionAttributes.hasOwnProperty('medication') ? sessionAttributes.medication : 0;
//         let timeList = sessionAttributes.hasOwnProperty('time') ? sessionAttributes.time : 0;
//         let weekdayList = sessionAttributes.hasOwnProperty('weekday') ? sessionAttributes.weekday : 0;
//         let reminderIdList = sessionAttributes.hasOwnProperty('reminderId') ? sessionAttributes.reminderId : 0;
        
//         let medId = -1
        
//         let i
//         for (i = 0; i < medicationList.length; i++) {
//             if (medicationList[i] === medication) {
//                 medId = i
//                 break
//             }
//         }
        
//         if (medId === -1) {
//             return handlerInput.responseBuilder
//                 .speak(`${medication} was not one of the medications we had an alarm for. Please give the name of the alert you wish to update or exit out.`)
//                 .getResponse();
//         }
        
//         // deviceId to get timezone
//         const serviceClientFactory = handlerInput.serviceClientFactory;
//         const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
        
//         // getting timezone
//         let userTimeZone;
//         try {
//             const upsServiceClient = handlerInput.serviceClientFactory.getUpsServiceClient();
//             userTimeZone = await upsServiceClient.getSystemTimeZone(deviceId);    
//         } catch (error) {
//             if (error.name !== 'ServiceError') {
//                 return handlerInput.responseBuilder.speak("There was a problem connecting to the service.").getResponse();
//             }
//             console.log('error', error.message);
//         }
        
//         // getting current date from moment
//         const currentDateTime = moment().tz(userTimeZone)
//         var currDow = currentDateTime.day() 
//         let scheduleDow = 0
        
//         let weekdayString
        
//         // getting dow from slot
//         if (weekday === 'Monday') {
//             scheduleDow = 1
//             weekdayString = "MO"
//         } else if (weekday === 'Tuesday') {
//             scheduleDow = 2
//             weekdayString = "TU"
//         } else if (weekday === 'Wednesday') {
//             scheduleDow = 3
//             weekdayString = "WE"
//         } else if (weekday === 'Thursday') {
//             scheduleDow = 4
//             weekdayString = "TH"
//         } else if (weekday === 'Friday') {
//             scheduleDow = 5
//             weekdayString = "FR"
//         } else if (weekday === 'Saturday') {
//             scheduleDow = 6
//             weekdayString = "SA"
//         } else if (weekday === 'Sunday') {
//             scheduleDow = 7
//             weekdayString = "SU"
//         }
        
//         // getting new date from current and scheduled dow
//         var newDate = currentDateTime.date()
//         if (currDow <= scheduleDow) {
//             newDate += (scheduleDow - currDow)
//         } else {
//             newDate += (7 + scheduleDow - currDow)
//         }
        
//         // setting new date to correct time during day
//         var reminderRequest;
//         const hour = +(10* time[0]) + +(time[1]);
//         const min = +(10* time[3]) + +(time[4]);
//         const newDateTime = moment().tz(userTimeZone);
//         newDateTime.set({
//             hour: hour,
//             minute: min,
//             second: '00'
//         })
        
//         if (scheduleDow === 0) {
//             let freqString = `FREQ=DAILY;BYHOUR=${hour};BYMINUTE=${min};BYSECOND=0`
//             reminderRequest = helpers.medReminder(currentDateTime, newDateTime, freqString, userTimeZone, medication)
//         } else { //scheduling weekly for a day of the week
//             newDateTime.set({
//                 date: newDate
//             })
//             let freqString = `FREQ=WEEKLY;BYDAY=${weekdayString};BYHOUR=${hour};BYMINUTE=${min};BYSECOND=0`
//             reminderRequest = helpers.medReminder(currentDateTime, newDateTime, freqString, userTimeZone, medication)
//         }
        
//         try {
//             await reminderApiClient.updateReminder(reminderIdList[medId], reminderRequest)
//         } catch(error) {
//             console.log(`${error}`)
//             return handlerInput.responseBuilder
//                 .speak(`There was an issue deleting the reminder for ${medication}. Please try again later.`)
//                 .getResponse();
//         }
        
//         timeList[medId] = time
//         weekdayList[medId] = weekday
        
//         const medicationAttributes = {
//             "medication" : medicationList,
//             "time" : timeList,
//             "weekday" : weekdayList,
//             "reminderId" : reminderIdList
//         };
        
//         attributesManager.setPersistentAttributes(medicationAttributes);
//         await attributesManager.savePersistentAttributes();
        
//         let speakOutput
//         if (weekdayList[medId] === 'Daily') {
//             speakOutput = `The daily alarm for ${medication} has been changed to ${helpers.sayTime(timeList[medId])}`
//         } else {
//             speakOutput = `The weekly alarm for ${medication} has been changed to ${helpers.sayTime(timeList[medId])} on ${weekdayList[medId]}`
//         }
        
//         return handlerInput.responseBuilder
//             .speak(speakOutput + ' Would you like to update another medication alert? If so, please give the name of the medication and the time you take it')
//             .reprompt('You may add, edit, or remove alarms by telling me to do so, or you can exit if you are satisfied with the alarms.')
//             .getResponse();
//     }
// };

const UpdateMedicationIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'UpdateMedicationIntent';
    },
    async handle(handlerInput) {
        
        const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient(),
            { permissions } = handlerInput.requestEnvelope.context.System.user
        
        if (!permissions) {
            return handlerInput.responseBuilder
                .speak('Please go the the Alexa Mobile App to grant reminders to permissions.')
                .withAskForPermissionsConsentCard(['alexa::alerts:reminders:skill:readwrite'])
                .getResponse()
        }
        
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
        
        const medication = handlerInput.requestEnvelope.request.intent.slots.medication.value;
        let time = handlerInput.requestEnvelope.request.intent.slots.time.value;
        let weekday = handlerInput.requestEnvelope.request.intent.slots.weekday.value;
        let oldTime = handlerInput.requestEnvelope.request.intent.slots.oldTime.value;
        let oldWeekday = handlerInput.requestEnvelope.request.intent.slots.oldWeekday.value;
        
        let medicationList = sessionAttributes.hasOwnProperty('medication') ? sessionAttributes.medication : 0;
        let timeList = sessionAttributes.hasOwnProperty('time') ? sessionAttributes.time : 0;
        let weekdayList = sessionAttributes.hasOwnProperty('weekday') ? sessionAttributes.weekday : 0;
        let reminderIdList = sessionAttributes.hasOwnProperty('reminderId') ? sessionAttributes.reminderId : 0;
        
        let medId = -1
        let i
        for (i = 0; i < medicationList.length; i++) {
            if (medicationList[i] === medication) {
                if (!oldTime && !oldWeekday) {
                    medId = i
                    oldTime = timeList[i]
                    oldWeekday = weekdayList[i]
                    break
                } else if (!oldTime) {
                    if (oldWeekday === weekdayList[i]) {
                        medId = i
                        oldTime = timeList[i]
                        break
                    }
                } else if (!oldWeekday) {
                    if (oldTime === timeList[i]) {
                        medId = i
                        oldWeekday = weekdayList[i]
                        break
                    }
                } else {
                    if (oldTime === timeList[i] && oldWeekday === weekdayList[i]) {
                        medId = i
                        break
                    }
                }
            }
        }
        
        if (medId === -1) {
            return handlerInput.responseBuilder
                .speak(`${medication} was not one of the medications we had an alarm for on ${oldWeekday} at ${oldTime}. Please give the name of the alert you wish to update or exit out.`)
                .getResponse();
        }
        
        // deviceId to get timezone
        const serviceClientFactory = handlerInput.serviceClientFactory;
        const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
        
        // getting timezone
        let userTimeZone;
        try {
            const upsServiceClient = handlerInput.serviceClientFactory.getUpsServiceClient();
            userTimeZone = await upsServiceClient.getSystemTimeZone(deviceId);    
        } catch (error) {
            if (error.name !== 'ServiceError') {
                return handlerInput.responseBuilder.speak("There was a problem connecting to the service.").getResponse();
            }
            console.log('error', error.message);
        }
        
        // getting current date from moment
        const currentDateTime = moment().tz(userTimeZone)
        var currDow = currentDateTime.day() 
        let scheduleDow = 0
        
        let weekdayString
        
        if (!weekday) {
            weekday = oldWeekday
        }
        if (!time) {
            time = oldTime
        }
        
        
        // getting dow from slot
        if (weekday === 'Monday') {
            scheduleDow = 1
            weekdayString = "MO"
        } else if (weekday === 'Tuesday') {
            scheduleDow = 2
            weekdayString = "TU"
        } else if (weekday === 'Wednesday') {
            scheduleDow = 3
            weekdayString = "WE"
        } else if (weekday === 'Thursday') {
            scheduleDow = 4
            weekdayString = "TH"
        } else if (weekday === 'Friday' || weekday === 'friday') {
            scheduleDow = 5
            weekdayString = "FR"
        } else if (weekday === 'Saturday') {
            scheduleDow = 6
            weekdayString = "SA"
        } else if (weekday === 'Sunday') {
            scheduleDow = 7
            weekdayString = "SU"
        }
        
        // getting new date from current and scheduled dow
        var newDate = currentDateTime.date()
        if (currDow <= scheduleDow) {
            newDate += (scheduleDow - currDow)
        } else {
            newDate += (7 + scheduleDow - currDow)
        }
        
        // setting new date to correct time during day
        var reminderRequest;
        const hour = +(10* time[0]) + +(time[1]);
        const min = +(10* time[3]) + +(time[4]);
        const newDateTime = moment().tz(userTimeZone);
        newDateTime.set({
            hour: hour,
            minute: min,
            second: '00'
        })
        
        if (scheduleDow === 0) {
            let freqString = `FREQ=DAILY;BYHOUR=${hour};BYMINUTE=${min};BYSECOND=0`
            reminderRequest = helpers.medReminder(currentDateTime, newDateTime, freqString, userTimeZone, medication)
        } else { //scheduling weekly for a day of the week
            newDateTime.set({
                date: newDate
            })
            let freqString = `FREQ=WEEKLY;BYDAY=${weekdayString};BYHOUR=${hour};BYMINUTE=${min};BYSECOND=0`
            reminderRequest = helpers.medReminder(currentDateTime, newDateTime, freqString, userTimeZone, medication)
        }
        
        try {
            await reminderApiClient.updateReminder(reminderIdList[medId], reminderRequest)
        } catch(error) {
            console.log(`${error}`)
            return handlerInput.responseBuilder
                .speak(`There was an issue deleting the reminder for ${medication}. Please try again later.`)
                .getResponse();
        }
        
        timeList[medId] = time
        weekdayList[medId] = weekday
        
        const medicationAttributes = {
            "medication" : medicationList,
            "time" : timeList,
            "weekday" : weekdayList,
            "reminderId" : reminderIdList
        };
        
        attributesManager.setPersistentAttributes(medicationAttributes);
        await attributesManager.savePersistentAttributes();
        
        let speakOutput
        if (weekdayList[medId] === 'Daily') {
            speakOutput = `The daily alarm for ${medication} has been changed to ${helpers.sayTime(timeList[medId])}`
        } else {
            speakOutput = `The weekly alarm for ${medication} has been changed to ${helpers.sayTime(timeList[medId])} on ${weekdayList[medId]}`
        }
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('Would you like to add another medication alert? If so, please give the medication and time you take it.')
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.stack}`);
        const speakOutput = `Sorry, I had trouble doing what you asked. Please try again.`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const LoadMedicationInterceptor = {
    async process(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = await attributesManager.getPersistentAttributes() || {};

        const medication = sessionAttributes.hasOwnProperty('medication') ? sessionAttributes.medication : 0;
        const time = sessionAttributes.hasOwnProperty('time') ? sessionAttributes.time : 0;
        const weekday = sessionAttributes.hasOwnProperty('weekday') ? sessionAttributes.weekday : 0;
        const reminderId = sessionAttributes.hasOwnProperty('reminderId') ? sessionAttributes.reminderId : 0;

        if (medication && time && weekday && reminderId) {
            attributesManager.setSessionAttributes(sessionAttributes);
        }
    }
};

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .withPersistenceAdapter(
        new persistenceAdapter.S3PersistenceAdapter({bucketName:process.env.S3_PERSISTENCE_BUCKET})
    )
    .addRequestHandlers(
        HasAlertsLaunchRequestHandler,
        LaunchRequestHandler,
        AddMedicationIntentHandler,
        DeleteMedicationIntentHandler,
        UpdateMedicationIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addRequestInterceptors(
        LoadMedicationInterceptor
    )
    .addErrorHandlers(
        ErrorHandler
    )
    .withApiClient(new Alexa.DefaultApiClient())
    .lambda();
