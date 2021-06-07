const Alexa = require('ask-sdk-core');
const persistenceAdapter = require('ask-sdk-s3-persistence-adapter');
const moment = require('moment-timezone');
const helpers = require('./helpers.js');
const AWS = require('aws-sdk')
let AWSregion = 'us-east-1';
AWS.config.update({region: AWSregion});

const HasAlertsLaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        
        let person = handlerInput.requestEnvelope.context.System.person;
        let personId
        if (person) {
           personId = person.personId; 
        } else {
            return handlerInput.responseBuilder
                .speak("Please set up a voice profile before using this skill. If you already have a voice profile set up, try again later.")
                .withShouldEndSession(true)
                .getResponse()
        }
        
        const { permissions } = handlerInput.requestEnvelope.context.System.user;
        
        if (!permissions) {
            handlerInput.responseBuilder
                .speak("Welcome to Medication Alert. This skill needs permissions to access your reminders. ")
                .addDirective({
                    type: "Connections.SendRequest",
                    name: "AskFor",
                    payload: {
                        "@type": "AskForPermissionsConsentRequest",
                        "@version": "1",
                        "permissionScope": "alexa::alerts:reminders:skill:readwrite"
                    },
                    token: ""
                })
                .getResponse()
        } else {
			
            let speakOutput 
        
            const attributesManager = handlerInput.attributesManager;
            const sessionAttributes = attributesManager.getSessionAttributes() || {};
            
			let medicalAttributes = sessionAttributes.hasOwnProperty('medicalAttributes') ? sessionAttributes.medicalAttributes : 0;
			let currentPersonIndex = sessionAttributes.hasOwnProperty('currentPersonIndex') ? sessionAttributes.currentPersonIndex : -1;
			let x
			let exists = false
			let index = -1
			if (medicalAttributes) {
			    for (x=0; x<medicalAttributes.length; x++) {
				    if (personId === medicalAttributes[x].pId) {
				    	exists = true
					    index = x
				    }
			    }
			} else {
			    medicalAttributes = []
			}
			
			let sessionPerson
			if (exists === true) {
				sessionPerson = medicalAttributes[index]
			} else {
				let personObject = {
					pId: personId,
					medication: 0,
					time: 0,
					weekday: 0,
					reminderId: 0,
					nextTime: 0,
					notified: 0,
					config: [1, 60, 0]
				}
				medicalAttributes.push(personObject)
				index = medicalAttributes.length - 1
				currentPersonIndex = index
				sessionPerson = personObject
			}
			
			let medicationList = sessionPerson.medication
            let timeList = sessionPerson.time
            let weekdayList = sessionPerson.weekday
            let reminderIdList = sessionPerson.reminderId
            let nextTimeList = sessionPerson.nextTime
            let notifiedList = sessionPerson.notified
            let configList = sessionPerson.config
            
            const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient()
            const reminderList = await reminderApiClient.getReminders();
            
            if (reminderList.totalCount==='0' && reminderIdList.length>0) {
                reminderIdList = []
                medicationList = []
                timeList = []
                weekdayList = []
                nextTimeList = []
                notifiedList = []
            } else if (reminderList.totalCount < reminderIdList.length) {
                let j
                let k
                for (j=reminderIdList.length-1; j>=0; j--) {
                    let temp = true
                    for (k=0; k<reminderList.totalCount;k++) {
                        if (reminderIdList[j].alertToken===reminderList.alerts[k].alertToken) {
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
                        nextTimeList.splice(j,1)
                        notifiedList.splice(j,1)
                    }
                } 
            }
            
			sessionPerson.medication = medicationList
			sessionPerson.time = timeList
			sessionPerson.weekday = weekdayList
			sessionPerson.reminderId = reminderIdList
			sessionPerson.nextTime = nextTimeList
			sessionPerson.notified = notifiedList
			sessionPerson.config = configList
			medicalAttributes[index] = sessionPerson
			
            const medicationAttributes = {
                "medicalAttributes": medicalAttributes,
				"currentPersonIndex" : index
            };
            attributesManager.setPersistentAttributes(medicationAttributes);
            await attributesManager.savePersistentAttributes();
            
            if (exists) {
                speakOutput = "<speak>Hello " + "<alexa:name type=\"first\" personId=\"" + personId + "\"/>" + ", Welcome back to Medication Alert! You may add, edit, remove, or repeat alerts if you'd like by telling me to do so.</speak>"
            } else {
                speakOutput = "<speak>Hello " + "<alexa:name type=\"first\" personId=\"" + personId + "\"/>" + ", Welcome to Medication Alert! You may add, edit, remove, or repeat alerts if you'd like by telling me to do so.</speak>"
            }
            
            
            handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt()
            
        }
        return handlerInput.responseBuilder
            .getResponse()
    }
};

const RepeatMedicationIntentHandler = {
  canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RepeatMedicationIntent';
    },
    async handle(handlerInput) {
        
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
            
        let medicalAttributes = sessionAttributes.hasOwnProperty('medicalAttributes') ? sessionAttributes.medicalAttributes : 0;
		let currentPersonIndex = sessionAttributes.hasOwnProperty('currentPersonIndex') ? sessionAttributes.currentPersonIndex : -1;
		
		let person = handlerInput.requestEnvelope.context.System.person;
        let personId 
        if (person) {
            personId = person.personId;
        } else {
            personId = medicalAttributes[currentPersonIndex].pId
        }
        let speakOutput
		
		let x
		let exists = false
		let index = -1
		if (medicalAttributes) {
		    for (x=0; x<medicalAttributes.length; x++) {
			    if (personId === medicalAttributes[x].pId) {
			    	exists = true
				    index = x
			    }
		    }
		} else {
		    medicalAttributes = []
		}
		
		let sessionPerson
		if (exists === true) {
			sessionPerson = medicalAttributes[index]
		} else {
			let personObject = {
				pId: personId,
				medication: 0,
				time: 0,
				weekday: 0,
				reminderId: 0,
				nextTime: 0,
				notified: 0,
				config: [1, 60, 0]
			}
			medicalAttributes.push(personObject)
			index = medicalAttributes.length - 1
			currentPersonIndex = index
			sessionPerson = personObject
		}
		
		let medicationList = sessionPerson.medication
        let timeList = sessionPerson.time
        let weekdayList = sessionPerson.weekday
        let reminderIdList = sessionPerson.reminderId
        let nextTimeList = sessionPerson.nextTime
        let notifiedList = sessionPerson.notified
        let configList = sessionPerson.config
        
        if (medicationList.length === 0 || medicationList === 0) {
            speakOutput = "You do not have any medication alarms currently set."
        } else if (medicationList.length === 1) {
            speakOutput = `The only alarm you currently have set is `
        } else {
            speakOutput = `The medication alarms you currently have set are `
        }
        let i
        for (i = 0; i < medicationList.length; i++) {
            if (i === medicationList.length - 1) {
                if (weekdayList[i] === 'daily' || weekdayList[i] === 'Daily') {
                    speakOutput += `${medicationList[i]} daily at ${helpers.sayTime(timeList[i])}.`
                } else {
                    speakOutput += `${medicationList[i]} every ${weekdayList[i]} at ${helpers.sayTime(timeList[i])}.`
                }
                break
            } else {
                if (weekdayList[i] === 'daily' || weekdayList[i] === 'Daily') {
                    speakOutput += `${medicationList[i]} daily at ${helpers.sayTime(timeList[i])}`
                } else {
                    speakOutput += `${medicationList[i]} every ${weekdayList[i]} at ${helpers.sayTime(timeList[i])}`
                }
            }
            speakOutput += `, and `
        }
        if (medicationList.length === 0 || medicationList === 0) {
            speakOutput += ` You may add an alert if you'd like, or you can exit if you don't want any alarms.`
        } else {
            speakOutput += ` You may add, edit, or remove alerts if you'd like by telling me to do so, or you can exit if you are satisfied with the current alerts.`
        }
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse()
    } 
};

const ConnectionsResponsetHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'Connections.Response';
  },
  handle(handlerInput) {
    const { permissions } = handlerInput.requestEnvelope.context.System.user;

    //console.log(JSON.stringify(handlerInput.requestEnvelope));
    //console.log(handlerInput.requestEnvelope.request.payload.status);

    const status = handlerInput.requestEnvelope.request.payload.status;


    if (!permissions) {
      return handlerInput.responseBuilder
        .speak("I didn't hear your answer. This skill requires your permission.")
        .addDirective({
          type: "Connections.SendRequest",
          name: "AskFor",
          payload: {
            "@type": "AskForPermissionsConsentRequest",
            "@version": "1",
            "permissionScope": "alexa::alerts:reminders:skill:readwrite"
          },
          token: "user-id-could-go-here"
        })
        .getResponse();
    }

    switch (status) {
      case "ACCEPTED":
        handlerInput.responseBuilder
          .speak("Thank you! Now that you've provided permission - you can set a medication alert by giving the medication, time, and day of the week.")
          .reprompt('To set a reminder, just give me the medication, time, and day of the week.')
        break;
      case "DENIED":
        handlerInput.responseBuilder
          .speak("Without permissions, I can't set a medication alert. So I guess that's goodbye.");
        break;
      case "NOT_ANSWERED":
        break;
      default:
        handlerInput.responseBuilder
          .speak("Thank you! Now that you've provided permission - you can set a medication alert by giving the medication, time, and day of the week.")
          .reprompt('To set a reminder, just give me the medication, time, and day of the week.')
    }

    return handlerInput.responseBuilder
      .getResponse();
  }
};

const ConfigChangeIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ConfigChangeIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
            
        let medicalAttributes = sessionAttributes.hasOwnProperty('medicalAttributes') ? sessionAttributes.medicalAttributes : 0;
		let currentPersonIndex = sessionAttributes.hasOwnProperty('currentPersonIndex') ? sessionAttributes.currentPersonIndex : -1;
		
		let person = handlerInput.requestEnvelope.context.System.person;
        let personId 
        if (person) {
            personId = person.personId;
        } else {
            personId = medicalAttributes[currentPersonIndex].pId
        }
        
        const numReminders = handlerInput.requestEnvelope.request.intent.slots.numReminders.value;
        let minsBetweenReminders = handlerInput.requestEnvelope.request.intent.slots.minsBetweenReminders.value;
        let phoneNumber = handlerInput.requestEnvelope.request.intent.slots.phoneNumber.value;
		
		let x
		let exists = false
		let index = -1
		if (medicalAttributes) {
		    for (x=0; x<medicalAttributes.length; x++) {
			    if (personId === medicalAttributes[x].pId) {
			    	exists = true
				    index = x
			    }
		    }
		} else {
		    medicalAttributes = []
		}
		
		let sessionPerson
		if (exists === true) {
			sessionPerson = medicalAttributes[index]
		} else {
			let personObject = {
				pId: personId,
				medication: 0,
				time: 0,
				weekday: 0,
				reminderId: 0,
				nextTime: 0,
				notified: 0,
				config: [1, 60, 0]
			}
			medicalAttributes.push(personObject)
			index = medicalAttributes.length - 1
			currentPersonIndex = index
			sessionPerson = personObject
		}
		
		let medicationList = sessionPerson.medication
        let timeList = sessionPerson.time
        let weekdayList = sessionPerson.weekday
        let reminderIdList = sessionPerson.reminderId
        let nextTimeList = sessionPerson.nextTime
        let notifiedList = sessionPerson.notified
        let configList = sessionPerson.config
        
        configList[0] = numReminders
        if (minsBetweenReminders < 60) {
            minsBetweenReminders = 60
        }
        configList[1] = minsBetweenReminders
        let spokenNumber
        if (phoneNumber.length === 10) {
            spokenNumber = phoneNumber
            phoneNumber = '+1' + phoneNumber
        } else if (phoneNumber.length === 11) {
            spokenNumber = phoneNumber
            phoneNumber = '+' + phoneNumber
        }
        configList[2] = phoneNumber
        console.log(numReminders)
        console.log(minsBetweenReminders)
        console.log(spokenNumber)
        
        sessionPerson.medication = medicationList
		sessionPerson.time = timeList
		sessionPerson.weekday = weekdayList
		sessionPerson.reminderId = reminderIdList
		sessionPerson.nextTime = nextTimeList
		sessionPerson.notified = notifiedList
		sessionPerson.config = configList
		medicalAttributes[currentPersonIndex] = sessionPerson
        
        const medicationAttributes = {
            "medicalAttributes" : medicalAttributes,
			"currentPersonIndex" : currentPersonIndex
        };
        attributesManager.setPersistentAttributes(medicationAttributes);
        await attributesManager.savePersistentAttributes();

        return handlerInput.responseBuilder
            .speak(`<speak>The number of reminders has been set to ${numReminders}, the minutes between reminders has been set to ${minsBetweenReminders}, and the caregiver phone number has been set to <say-as interpret-as='telephone'>${spokenNumber}</say-as>.</speak>`)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            // .speak("hi")
            .reprompt()
            .getResponse();
    }
};

const ConfigDefaultIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ConfigDefaultIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
            
        let medicalAttributes = sessionAttributes.hasOwnProperty('medicalAttributes') ? sessionAttributes.medicalAttributes : 0;
		let currentPersonIndex = sessionAttributes.hasOwnProperty('currentPersonIndex') ? sessionAttributes.currentPersonIndex : -1;
		
		let person = handlerInput.requestEnvelope.context.System.person;
        let personId 
        if (person) {
            personId = person.personId;
        } else {
            personId = medicalAttributes[currentPersonIndex].pId
        }
		
		let x
		let exists = false
		let index = -1
		if (medicalAttributes) {
		    for (x=0; x<medicalAttributes.length; x++) {
			    if (personId === medicalAttributes[x].pId) {
			    	exists = true
				    index = x
			    }
		    }
		} else {
		    medicalAttributes = []
		}
		
		let sessionPerson
		if (exists === true) {
			sessionPerson = medicalAttributes[index]
		} else {
			let personObject = {
				pId: personId,
				medication: 0,
				time: 0,
				weekday: 0,
				reminderId: 0,
				nextTime: 0,
				notified: 0,
				config: [1, 60, 0]
			}
			medicalAttributes.push(personObject)
			index = medicalAttributes.length - 1
			currentPersonIndex = index
			sessionPerson = personObject
		}
		
		let medicationList = sessionPerson.medication
        let timeList = sessionPerson.time
        let weekdayList = sessionPerson.weekday
        let reminderIdList = sessionPerson.reminderId
        let nextTimeList = sessionPerson.nextTime
        let notifiedList = sessionPerson.notified
        let configList = sessionPerson.config
        
        configList = [1, 60, 0]
        
        sessionPerson.medication = medicationList
		sessionPerson.time = timeList
		sessionPerson.weekday = weekdayList
		sessionPerson.reminderId = reminderIdList
		sessionPerson.nextTime = nextTimeList
		sessionPerson.notified = notifiedList
		sessionPerson.config = configList
		medicalAttributes[currentPersonIndex] = sessionPerson
        
        const medicationAttributes = {
            "medicalAttributes" : medicalAttributes,
			"currentPersonIndex" : currentPersonIndex
        };
        attributesManager.setPersistentAttributes(medicationAttributes);
        await attributesManager.savePersistentAttributes();

        return handlerInput.responseBuilder
            .speak(`The config has been reset back to its default state.`)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

const ResetAlertsIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ResetAlertsIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
            
        let medicalAttributes = sessionAttributes.hasOwnProperty('medicalAttributes') ? sessionAttributes.medicalAttributes : 0;
		let currentPersonIndex = sessionAttributes.hasOwnProperty('currentPersonIndex') ? sessionAttributes.currentPersonIndex : -1;
		
		let person = handlerInput.requestEnvelope.context.System.person;
        let personId 
        if (person) {
            personId = person.personId;
        } else {
            personId = medicalAttributes[currentPersonIndex].pId
        }
        
        const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient()
        
		
		let x
		let exists = false
		let index = -1
		if (medicalAttributes) {
		    for (x=0; x<medicalAttributes.length; x++) {
			    if (personId === medicalAttributes[x].pId) {
			    	exists = true
				    index = x
			    }
		    }
		} else {
		    medicalAttributes = []
		}
		
		let sessionPerson
		if (exists === true) {
			sessionPerson = medicalAttributes[index]
		} else {
			let personObject = {
				pId: personId,
				medication: 0,
				time: 0,
				weekday: 0,
				reminderId: 0,
				nextTime: 0,
				notified: 0,
				config: [1, 60, 0]
			}
			medicalAttributes.push(personObject)
			index = medicalAttributes.length - 1
			currentPersonIndex = index
			sessionPerson = personObject
		}
		
		let medicationList = sessionPerson.medication
        let timeList = sessionPerson.time
        let weekdayList = sessionPerson.weekday
        let reminderIdList = sessionPerson.reminderId
        let nextTimeList = sessionPerson.nextTime
        let notifiedList = sessionPerson.notified
        let configList = sessionPerson.config
        let i
        for (i = medicationList.length - 1; i >= 0; i--) {
            try {
                await reminderApiClient.deleteReminder(reminderIdList[i].alertToken)
            } catch(error) {
                console.log(`${error}`)
                return handlerInput.responseBuilder
                    .speak(`There was an issue deleting the reminder for ${medicationList[i]}. Please try again later.`)
                    .getResponse();
            }
            reminderIdList.splice(i,1)
            medicationList.splice(i,1)
            timeList.splice(i,1)
            weekdayList.splice(i,1)
            nextTimeList.splice(i,1)
            notifiedList.splice(i,1)
        }
        
        
        sessionPerson.medication = medicationList
		sessionPerson.time = timeList
		sessionPerson.weekday = weekdayList
		sessionPerson.reminderId = reminderIdList
		sessionPerson.nextTime = nextTimeList
		sessionPerson.notified = notifiedList
		sessionPerson.config = configList
		medicalAttributes[currentPersonIndex] = sessionPerson
        
        const medicationAttributes = {
            "medicalAttributes" : medicalAttributes,
			"currentPersonIndex" : currentPersonIndex
        };
        attributesManager.setPersistentAttributes(medicationAttributes);
        await attributesManager.savePersistentAttributes();

        return handlerInput.responseBuilder
            .speak(`All alerts have been deleted.`)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .reprompt()
            .getResponse();
    }
};

const HaveTakenMedicationIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HaveTakenMedsIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
            
        let medicalAttributes = sessionAttributes.hasOwnProperty('medicalAttributes') ? sessionAttributes.medicalAttributes : 0;
		let currentPersonIndex = sessionAttributes.hasOwnProperty('currentPersonIndex') ? sessionAttributes.currentPersonIndex : -1;
		
		let person = handlerInput.requestEnvelope.context.System.person;
        let personId 
        if (person) {
            personId = person.personId;
        } else {
            personId = medicalAttributes[currentPersonIndex].pId
        }
        
        const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient()
        
        const medication = handlerInput.requestEnvelope.request.intent.slots.medication.value;
        const time = handlerInput.requestEnvelope.request.intent.slots.time.value;
        let timeFlag
        if (!time) {
            timeFlag = false
        } else {
            timeFlag = true
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
        
		
		let y
		let exists = false
		let index = -1
		if (medicalAttributes) {
		    for (y=0; y<medicalAttributes.length; y++) {
			    if (personId === medicalAttributes[y].pId) {
			    	exists = true
				    index = y
			    }
		    }
		} else {
		    medicalAttributes = []
		}
		
		let sessionPerson
		if (exists === true) {
			sessionPerson = medicalAttributes[index]
		} else {
			let personObject = {
				pId: personId,
				medication: 0,
				time: 0,
				weekday: 0,
				reminderId: 0,
				nextTime: 0,
				notified: 0,
				config: [1, 60, 0]
			}
			medicalAttributes.push(personObject)
			index = medicalAttributes.length - 1
			currentPersonIndex = index
			sessionPerson = personObject
		}
		
		let medicationList = sessionPerson.medication
        let timeList = sessionPerson.time
        let weekdayList = sessionPerson.weekday
        let reminderIdList = sessionPerson.reminderId
        let nextTimeList = sessionPerson.nextTime
        let notifiedList = sessionPerson.notified
        let configList = sessionPerson.config
        
        const numReminders = configList[0]
        const minsBetweenReminders = configList[1]
        let phoneNumber = configList[2]
        
        let medIdList = []
        
        let i
        for (i = 0; i < medicationList.length; i++) {
            if (currentDateTime.isAfter(nextTimeList[i]) && notifiedList[i]) {
                notifiedList[i] = false
            }
            if (medicationList[i] === medication) {
                if (helpers.dowConversion(weekdayList[i]).num === helpers.dowConversion(currDow).num || helpers.dowConversion(weekdayList[i]).num === 7) {
                    if (notifiedList[i] === false && currentDateTime.isAfter(nextTimeList[i])) {
                        if ((timeFlag && time === timeList[i]) || !timeFlag) {
                            medIdList.push(i)
                        }
                    }
                }
            }
        }
        
        let speakOutput
        
        if (medIdList.length === 0) {
            if (timeFlag) {
                speakOutput = `There are no alerts for ${medication} at ${helpers.sayTime(time)} that have gone off earlier today or they have already been taken. Please try again later.`
            } else {
                speakOutput = `There are no alerts for ${medication} that have gone off earlier today or they have already been taken. Please try again later.`
            }
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
        } else if (medIdList.length === 1) {
            speakOutput = 'The alarm for '
        } else {
            speakOutput = 'The alarms for '
        }
        
        let x
        for (x = 0; x < medIdList.length; x++) {
            let time = timeList[medIdList[x]]
            const hour = +(10* time[0]) + +(time[1]);
            const min = +(10* time[3]) + +(time[4]);
            let dow = helpers.dowConversion(weekdayList[medIdList[x]])
            let weekdayString = dow.string
            
            const newDateTime = moment().tz(userTimeZone);
            newDateTime.set({
                hour: hour,
                minute: min,
                second: '00'
            })
            
            if (dow.num === 7) {
                newDateTime.set({
                    day: dow
                })
                newDateTime.set({
                    date: newDateTime.date() + 1
                })
            } else {
                newDateTime.set({
                    day: dow
                })
                newDateTime.set({
                    date: newDateTime.date() + 7
                })
            }
            
            let k
            let freqStringList = []
            let reminderRequest
            for (k = 0; k < numReminders; k++) {
                if (dow.num === 7) {
                    if (k !== 0) {
                        newDateTime.set({
                            minute: parseInt(newDateTime.minute()) + parseInt(minsBetweenReminders)
                        })
                    }
                    let freqString = `FREQ=DAILY;BYHOUR=${newDateTime.hour()};BYMINUTE=${newDateTime.minute()};BYSECOND=0;INTERVAL=1`
                    freqStringList.push(freqString)
                } else { //scheduling weekly for a day of the week
                    if (k !== 0) {
                        newDateTime.set({
                            minute: parseInt(newDateTime.minute()) + parseInt(minsBetweenReminders)
                        })
                    }
                    weekdayString = helpers.dowConversion(newDateTime.day()).string
                    let freqString = `FREQ=WEEKLY;BYDAY=${weekdayString};BYHOUR=${newDateTime.hour()};BYMINUTE=${newDateTime.minute()};BYSECOND=0;INTERVAL=1`
                    freqStringList.push(freqString)
                }
            }
            
            newDateTime.set({
                minute : parseInt(newDateTime.minute()) - ((parseInt(numReminders) - 1) * parseInt(minsBetweenReminders)) - 1
            })
            
            let reminderMsgSSML =  "<speak>Hello <alexa:name type=\"first\" personId=\"" + sessionPerson.pId + "\"/>" + ", it's time to take " + medication + ". Please notify me when you've taken your " + medication + ".</speak>"
            reminderRequest = helpers.medReminder(currentDateTime, newDateTime, freqStringList, userTimeZone, medication, reminderMsgSSML)
            
            let reminderResponse
            
            try {
                reminderResponse = await reminderApiClient.updateReminder(reminderIdList[medIdList[x]].alertToken, reminderRequest)
            } catch(error) {
                console.log(`${error}`)
                return handlerInput.responseBuilder
                    .speak(`There was an issue deleting the reminder for ${medication}. Please try again later.`)
                    .getResponse();
            }
            
            if (phoneNumber !== 0) {
                 // 1. Assume the AWS resource role using STS AssumeRole Action
                const STS = new AWS.STS({ apiVersion: '2011-06-15' });
                const credentials = await STS.assumeRole({
                    RoleArn: 'arn:aws:iam::226129166992:role/Alexa',
                    RoleSessionName: 'MedicationAlertNotificationRoleSession' // You can rename with any name
                }, (err, res) => {
                    if (err) {
                        console.log('AssumeRole FAILED: ', err);
                        throw new Error('Error while assuming role');
                    }
                    return res;
                }).promise();
                
                let messageBody = `${medication} scheduled for `
                if (helpers.dowConversion(weekdayList[medIdList[x]]).num === 7) {
                    messageBody += `${helpers.sayTime(timeList[medIdList[x]])} daily`
                } else {
                    messageBody += `${helpers.sayTime(timeList[medIdList[x]])} on ${weekdayList[medIdList[x]]}`
                }
                messageBody += ` has been taken.`
                let params = { PhoneNumber: phoneNumber,
                              Message: messageBody };
        
                const SNS = new AWS.SNS({
                    accessKeyId: credentials.Credentials.AccessKeyId,
                    secretAccessKey: credentials.Credentials.SecretAccessKey,
                    sessionToken: credentials.Credentials.SessionToken
                });
        
                await SNS.publish(params, (err, data)=>{
                    console.log('sending message to ' + params.PhoneNumber.toString() );
        
                    if (err) {
                        console.log(err, err.stack);
                    }
                    return data
                })
            }
            
            reminderIdList[medIdList[x]] = reminderResponse
            nextTimeList[medIdList[x]] = newDateTime
            notifiedList[medIdList[x]] = true
            
            if (helpers.dowConversion(weekdayList[medIdList[x]]).num === 7) {
                speakOutput += ` ${medication} at ${helpers.sayTime(timeList[medIdList[x]])} daily`
            } else {
                speakOutput += ` ${medication} at ${helpers.sayTime(timeList[medIdList[x]])} on ${weekdayList[medIdList[x]]}`
            }
            if (x !== medicationList.length - 1) {
                speakOutput += `, `
            }
        }
        
        sessionPerson.medication = medicationList
		sessionPerson.time = timeList
		sessionPerson.weekday = weekdayList
		sessionPerson.reminderId = reminderIdList
		sessionPerson.nextTime = nextTimeList
		sessionPerson.notified = notifiedList
		sessionPerson.config = configList
		medicalAttributes[currentPersonIndex] = sessionPerson
        
        const medicationAttributes = {
            "medicalAttributes" : medicalAttributes,
			"currentPersonIndex" : currentPersonIndex
        };
        attributesManager.setPersistentAttributes(medicationAttributes);
        await attributesManager.savePersistentAttributes();
        
        if (medIdList.length === 1) {
            speakOutput += ' has been recorded as taken. '
        } else {
            speakOutput += ' have been recorded as taken. '
        }
        
        return handlerInput.responseBuilder
                .speak(speakOutput + `Thank you for notifying me.`)
                .reprompt()
                .getResponse();
    }
};

const TakenMedicationCheckIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'TakenMedicationIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
            
        let medicalAttributes = sessionAttributes.hasOwnProperty('medicalAttributes') ? sessionAttributes.medicalAttributes : 0;
		let currentPersonIndex = sessionAttributes.hasOwnProperty('currentPersonIndex') ? sessionAttributes.currentPersonIndex : -1;
		
		let person = handlerInput.requestEnvelope.context.System.person;
        let personId 
        if (person) {
            personId = person.personId;
        } else {
            personId = medicalAttributes[currentPersonIndex].pId
        }
        
        const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient()
        
        const medication = handlerInput.requestEnvelope.request.intent.slots.medication.value;
        const time = handlerInput.requestEnvelope.request.intent.slots.time.value;
        let timeFlag
        if (!time) {
            timeFlag = false
        } else {
            timeFlag = true
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

		
		let x
		let exists = false
		let index = -1
		if (medicalAttributes) {
		    for (x=0; x<medicalAttributes.length; x++) {
			    if (personId === medicalAttributes[x].pId) {
			    	exists = true
				    index = x
			    }
		    }
		} else {
		    medicalAttributes = []
		}
		
		let sessionPerson
		if (exists === true) {
			sessionPerson = medicalAttributes[index]
		} else {
			let personObject = {
				pId: personId,
				medication: 0,
				time: 0,
				weekday: 0,
				reminderId: 0,
				nextTime: 0,
				notified: 0,
				config: [1, 60, 0]
			}
			medicalAttributes.push(personObject)
			index = medicalAttributes.length - 1
			currentPersonIndex = index
			sessionPerson = personObject
		}
		
		let medicationList = sessionPerson.medication
        let timeList = sessionPerson.time
        let weekdayList = sessionPerson.weekday
        let reminderIdList = sessionPerson.reminderId
        let nextTimeList = sessionPerson.nextTime
        let notifiedList = sessionPerson.notified
        let configList = sessionPerson.config
        
        const numReminders = configList[0]
        const minsBetweenReminders = configList[1]
        
        let takenList = []
        let notTakenList = []
        
        let i
        for (i = 0; i < medicationList.length; i++) {
            if (currentDateTime.isAfter(nextTimeList[i]) && notifiedList[i]) {
                notifiedList[i] = false
            }
            if (medicationList[i] === medication && notifiedList[i] === true) {
                if ((timeFlag && time === timeList[i]) || !timeFlag) {
                    takenList.push(i)
                }
            } else if (medicationList[i] === medication && notifiedList[i] === false) {
                if ((timeFlag && time === timeList[i]) || !timeFlag) {
                    notTakenList.push(i)
                }
            }
        }
        
        console.log("takenList", takenList) 
        console.log("notTakenList", notTakenList) 
        if (takenList.length === 0 && notTakenList.length === 0) {
            return handlerInput.responseBuilder
                .speak(`There are no alerts set for the medication ${medication}. Sorry!`)
                .getResponse();
        }
        
        let speakOutput = ''
        let j
        for (j = 0; j < takenList.length; j++) {
            if (helpers.dowConversion(weekdayList[takenList[j]]).num !== 7) {
                speakOutput += `You have taken ${medication} at ${helpers.sayTime(timeList[takenList[j]])} on ${weekdayList[takenList[j]]}`
            } else {
                speakOutput += `You have taken ${medication} at ${helpers.sayTime(timeList[takenList[j]])} daily`
            }
            if (j === takenList.length - 1) {
                speakOutput += ". "
            } else {
                speakOutput += ", "
            }
        }
        
        let k
        for (k = 0; k < notTakenList.length; k++) {
            if (helpers.dowConversion(weekdayList[notTakenList[k]]).num !== 7) {
                speakOutput += `You have not taken ${medication} at ${helpers.sayTime(timeList[notTakenList[k]])} on ${weekdayList[notTakenList[k]]}`
            } else {
                speakOutput += `You have not taken ${medication} at ${helpers.sayTime(timeList[notTakenList[k]])} daily`
            }
            if (j === takenList.length - 1) {
                speakOutput += ". "
            } else {
                speakOutput += ", "
            }
        }
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt()
            .getResponse();
    }
};

const AddMedicationIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AddMedicationIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
            
        let medicalAttributes = sessionAttributes.hasOwnProperty('medicalAttributes') ? sessionAttributes.medicalAttributes : 0;
		let currentPersonIndex = sessionAttributes.hasOwnProperty('currentPersonIndex') ? sessionAttributes.currentPersonIndex : -1;
		
		let person = handlerInput.requestEnvelope.context.System.person;
        let personId 
        if (person) {
            personId = person.personId;
        } else {
            personId = medicalAttributes[currentPersonIndex].pId
        }
        
        const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient()
        
        const medication = handlerInput.requestEnvelope.request.intent.slots.medication.value;
        const time = handlerInput.requestEnvelope.request.intent.slots.time.value;
        const weekday = handlerInput.requestEnvelope.request.intent.slots.weekday.value;
        
        
        // deviceId to get timezone
        const serviceClientFactory = handlerInput.serviceClientFactory;
        const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;

		
		let x
		let exists = false
		let index = -1
		if (medicalAttributes) {
		    for (x=0; x<medicalAttributes.length; x++) {
			    if (personId === medicalAttributes[x].pId) {
			    	exists = true
				    index = x
			    }
		    }
		} else {
		    medicalAttributes = []
		}
		
		let sessionPerson
		if (exists === true) {
			sessionPerson = medicalAttributes[index]
		} else {
			let personObject = {
				pId: personId,
				medication: 0,
				time: 0,
				weekday: 0,
				reminderId: 0,
				nextTime: 0,
				notified: 0,
				config: [1, 60, 0]
			}
			medicalAttributes.push(personObject)
			index = medicalAttributes.length - 1
			currentPersonIndex = index
			sessionPerson = personObject
		}
		
		let medicationList = sessionPerson.medication
        let timeList = sessionPerson.time
        let weekdayList = sessionPerson.weekday
        let reminderIdList = sessionPerson.reminderId
        let nextTimeList = sessionPerson.nextTime
        let notifiedList = sessionPerson.notified
        let configList = sessionPerson.config
        
        const numReminders = configList[0]
        const minsBetweenReminders = configList[1]
        
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
        let scheduleDow = 7
        
        let weekdayString
        
        // getting dow from slot
        let dow = helpers.dowConversion(weekday)
        
        scheduleDow = dow.num
        weekdayString = dow.string
        
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
        
        let k
        let freqStringList = []
        
        if (scheduleDow !== 7) {
            newDateTime.set({
                date: newDate
            })
        }
        
        for (k = 0; k < numReminders; k++) {
            if (scheduleDow === 7) {
                if (k !== 0) {
                    console.log("newDateTime.minute pre change", newDateTime.minute())
                    console.log("minsBetweenReminders + newDateTime.minute()", minsBetweenReminders + newDateTime.minute())
                    newDateTime.set({
                        minute: parseInt(newDateTime.minute()) + parseInt(minsBetweenReminders)
                    })
                    console.log("newDateTime.minute post change", newDateTime.minute())
                }
                
                let freqString = `FREQ=DAILY;BYHOUR=${newDateTime.hour()};BYMINUTE=${newDateTime.minute()};BYSECOND=0;INTERVAL=1`
                freqStringList.push(freqString)
                console.log("dailyFreqString", freqString)
            } else { //scheduling weekly for a day of the week
                if (k !== 0) {
                    newDateTime.set({
                        minute: parseInt(newDateTime.minute()) + parseInt(minsBetweenReminders)
                    })
                }
                weekdayString = helpers.dowConversion(newDateTime.day()).string
                let freqString = `FREQ=WEEKLY;BYDAY=${weekdayString};BYHOUR=${newDateTime.hour()};BYMINUTE=${newDateTime.minute()};BYSECOND=0;INTERVAL=1`
                freqStringList.push(freqString)
                console.log(freqString)
            }
        }
        
        console.log(freqStringList)
        newDateTime.set({
            minute : parseInt(newDateTime.minute()) - ((parseInt(numReminders) - 1) * parseInt(minsBetweenReminders)) - 1
        })
        
        let reminderMsgSSML =  "<speak>Hello <alexa:name type=\"first\" personId=\"" + sessionPerson.pId + "\"/>" + ", it's time to take " + medication + ". Please notify me when you've taken your " + medication + ".</speak>"
        reminderRequest = helpers.medReminder(currentDateTime, newDateTime, freqStringList, userTimeZone, medication, reminderMsgSSML)
        
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
        
        const reminderId = reminderResponse
        
        if (medicationList && timeList && weekdayList && reminderIdList) {
            medicationList.push(medication);
            timeList.push(time);
            weekdayList.push(weekday);
            reminderIdList.push(reminderId);
            nextTimeList.push(newDateTime);
            notifiedList.push(false);
        } else {
            medicationList = [medication];
            timeList = [time];
            weekdayList = [weekday];
            reminderIdList = [reminderId];
            nextTimeList = [newDateTime];
            notifiedList = [false];
        }
		
		sessionPerson.medication = medicationList
		sessionPerson.time = timeList
		sessionPerson.weekday = weekdayList
		sessionPerson.reminderId = reminderIdList
		sessionPerson.nextTime = nextTimeList
		sessionPerson.notified = notifiedList
		sessionPerson.config = configList
		medicalAttributes[currentPersonIndex] = sessionPerson
        
        const medicationAttributes = {
            "medicalAttributes" : medicalAttributes,
			"currentPersonIndex" : currentPersonIndex
        };
        attributesManager.setPersistentAttributes(medicationAttributes);
        await attributesManager.savePersistentAttributes();
        
        let speakOutput
        if (scheduleDow === 7) {
            speakOutput = `Thanks, we will remember that you need to take ${medication} at ${helpers.sayTime(time)} ${weekday}.`
        } else {
            speakOutput = `Thanks, we will remember that you need to take ${medication} at ${helpers.sayTime(time)} on ${weekday}.`
        }
        return handlerInput.responseBuilder
            .speak(speakOutput + ' You may add, delete, or change another reminder.')
            .reprompt("You may add, delete, or change a reminder, or you can exit from the skill.")
            .getResponse()
        
    }
};

const DeleteMedicationIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'DeleteMedicationIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
            
        let medicalAttributes = sessionAttributes.hasOwnProperty('medicalAttributes') ? sessionAttributes.medicalAttributes : 0;
		let currentPersonIndex = sessionAttributes.hasOwnProperty('currentPersonIndex') ? sessionAttributes.currentPersonIndex : -1;
		
		let person = handlerInput.requestEnvelope.context.System.person;
        let personId 
        if (person) {
            personId = person.personId;
        } else {
            personId = medicalAttributes[currentPersonIndex].pId
        }
        
        const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient()

        
        const medication = handlerInput.requestEnvelope.request.intent.slots.medication.value;
        let time = handlerInput.requestEnvelope.request.intent.slots.time.value;
        let weekday = handlerInput.requestEnvelope.request.intent.slots.weekday.value;

		
		let x
		let exists = false
		let index = -1
		if (medicalAttributes) {
		    for (x=0; x<medicalAttributes.length; x++) {
			    if (personId === medicalAttributes[x].pId) {
			    	exists = true
				    index = x
			    }
		    }
		} else {
		    medicalAttributes = []
		}
		
		let sessionPerson
		if (exists === true) {
			sessionPerson = medicalAttributes[index]
		} else {
			let personObject = {
				pId: personId,
				medication: 0,
				time: 0,
				weekday: 0,
				reminderId: 0,
				nextTime: 0,
				notified: 0,
				config: [1, 60, 0]
			}
			medicalAttributes.push(personObject)
			index = medicalAttributes.length - 1
			currentPersonIndex = index
			sessionPerson = personObject
		}
		
		let medicationList = sessionPerson.medication
        let timeList = sessionPerson.time
        let weekdayList = sessionPerson.weekday
        let reminderIdList = sessionPerson.reminderId
        let nextTimeList = sessionPerson.nextTime
        let notifiedList = sessionPerson.notified
        let configList = sessionPerson.config
        
        if (medicationList.length === 0) {
            return handlerInput.responseBuilder
              .speak("You can't delete a medication without any alarms set! If you'd like to add an alarm, just tell me the medication, time, and day of the week.")
              .reprompt('You need to make an alarm before you can delete alarms.')
              .getResponse();
        }
        
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
        
        if (medId === -1) {
            return handlerInput.responseBuilder
                .speak(`We couldn't find the alarm you specified. Please say to delete the medication, time, and weekday of the alarm you wish to delete or exit out.`)
                .getResponse();
        }
        
        try {
            await reminderApiClient.deleteReminder(reminderIdList[medId].alertToken)
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
        nextTimeList.splice(medId, 1)
        notifiedList.splice(medId, 1)
        
        sessionPerson.medication = medicationList
		sessionPerson.time = timeList
		sessionPerson.weekday = weekdayList
		sessionPerson.reminderId = reminderIdList
		sessionPerson.nextTime = nextTimeList
		sessionPerson.notified = notifiedList
		sessionPerson.config = configList
		medicalAttributes[currentPersonIndex] = sessionPerson
        
        const medicationAttributes = {
            "medicalAttributes" : medicalAttributes,
			"currentPersonIndex" : currentPersonIndex
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
            .reprompt('You may add, edit, or remove another alarm by telling me to do so, or exit if you are satisfied with the alarms.')
            .getResponse();
    }
};

const UpdateMedicationIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'UpdateMedicationIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
            
        let medicalAttributes = sessionAttributes.hasOwnProperty('medicalAttributes') ? sessionAttributes.medicalAttributes : 0;
		let currentPersonIndex = sessionAttributes.hasOwnProperty('currentPersonIndex') ? sessionAttributes.currentPersonIndex : -1;
		
		let person = handlerInput.requestEnvelope.context.System.person;
        let personId 
        if (person) {
            personId = person.personId;
        } else {
            personId = medicalAttributes[currentPersonIndex].pId
        }
        
        const reminderApiClient = handlerInput.serviceClientFactory.getReminderManagementServiceClient()
        

        
        const medication = handlerInput.requestEnvelope.request.intent.slots.medication.value;
        let time = handlerInput.requestEnvelope.request.intent.slots.time.value;
        let weekday = handlerInput.requestEnvelope.request.intent.slots.weekday.value;
        let oldTime = handlerInput.requestEnvelope.request.intent.slots.oldTime.value;
        let oldWeekday = handlerInput.requestEnvelope.request.intent.slots.oldWeekday.value;
        
		
		let x
		let exists = false
		let index = -1
		if (medicalAttributes) {
		    for (x=0; x<medicalAttributes.length; x++) {
			    if (personId === medicalAttributes[x].pId) {
			    	exists = true
				    index = x
			    }
		    }
		} else {
		    medicalAttributes = []
		}
		
		let sessionPerson
		if (exists === true) {
			sessionPerson = medicalAttributes[index]
		} else {
			let personObject = {
				pId: personId,
				medication: 0,
				time: 0,
				weekday: 0,
				reminderId: 0,
				nextTime: 0,
				notified: 0,
				config: [1, 60, 0]
			}
			medicalAttributes.push(personObject)
			index = medicalAttributes.length - 1
			currentPersonIndex = index
			sessionPerson = personObject
		}
		
		let medicationList = sessionPerson.medication
        let timeList = sessionPerson.time
        let weekdayList = sessionPerson.weekday
        let reminderIdList = sessionPerson.reminderId
        let nextTimeList = sessionPerson.nextTime
        let notifiedList = sessionPerson.notified
        let configList = sessionPerson.config
        
        const numReminders = configList[0]
        const minsBetweenReminders = configList[1]
        
        if (medicationList.length === 0) {
            return handlerInput.responseBuilder
              .speak("You can't update a medication without any alarms set! If you'd like to add an alarm, just tell me the medication, time, and day of the week.")
              .reprompt('You need to make an alarm before you can change alarms.')
              .getResponse();
        }
        
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
            let repromptMsg = `You can also choose to add or delete a notification instead, just let me know what you want to do.`
            if (!oldTime && !oldWeekday) {
                return handlerInput.responseBuilder
                    .speak(`You haven't set an alert for ${medication}. Please tell me the to update the medication you want to change or exit out.`)
                    .reprompt(repromptMsg)
                    .getResponse();
            } else if (!oldTime) {
                let speakOutput = `You haven't set an alert for ${medication} on ${oldWeekday}. Please tell me the to update the medication you want to change or exit out.`
                if (oldWeekday === 'DAILY' || oldWeekday === 'daily' || oldWeekday === 'Daily') {
                    speakOutput = `You haven't set a daily alert for ${medication}. Please tell me the to update the medication you want to change or exit out.`
                }
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt(repromptMsg)
                    .getResponse();
            } else if (!oldWeekday) {
                return handlerInput.responseBuilder
                    .speak(`You haven't set an alert for ${medication} at ${oldTime}. Please tell me the to update the medication you want to change or exit out.`)
                    .reprompt(repromptMsg)
                    .getResponse();
            } else {
                let speakOutput = `You haven't set an alert for ${medication} on ${oldWeekday} at ${oldTime}. Please tell me the to update the medication you want to change or exit out.`
                if (oldWeekday === 'DAILY' || oldWeekday === 'daily' || oldWeekday === 'Daily') {
                    speakOutput = `You haven't set a daily alert for ${medication} at ${oldTime}. Please tell me the to update the medication you want to change or exit out.`
                }
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt(repromptMsg)
                    .getResponse();
            }
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
        let scheduleDow = 7
        
        let weekdayString
        
        if (!weekday) {
            weekday = oldWeekday
        }
        if (!time) {
            time = oldTime
        }
        
        // getting dow from slot
        let dow = helpers.dowConversion(weekday)
        
        weekdayString = dow.string
        scheduleDow = dow.num
        
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
        
        let k
        let freqStringList = []
        for (k = 0; k < numReminders; k++) {
            if (scheduleDow === 7) {
                if (k !== 0) {
                    newDateTime.set({
                        minute: parseInt(newDateTime.minute()) + parseInt(minsBetweenReminders)
                    })
                }
                let freqString = `FREQ=DAILY;BYHOUR=${newDateTime.hour()};BYMINUTE=${newDateTime.minute()};BYSECOND=0;INTERVAL=1`
                freqStringList.push(freqString)
            } else { //scheduling weekly for a day of the week
                if (k !== 0) {
                    newDateTime.set({
                        minute: parseInt(newDateTime.minute()) + parseInt(minsBetweenReminders)
                    })
                }
                weekdayString = helpers.dowConversion(newDateTime.day()).string
                let freqString = `FREQ=WEEKLY;BYDAY=${weekdayString};BYHOUR=${newDateTime.hour()};BYMINUTE=${newDateTime.minute()};BYSECOND=0;INTERVAL=1`
                freqStringList.push(freqString)
            }
        }
        
        newDateTime.set({
            minute : parseInt(newDateTime.minute()) - ((parseInt(numReminders) - 1) * parseInt(minsBetweenReminders)) - 1
        })
        
        let reminderMsgSSML =  "<speak>Hello <alexa:name type=\"first\" personId=\"" + sessionPerson.pId + "\"/>" + ", it's time to take " + medication + ". Please notify me when you've taken your " + medication + ".</speak>"
        reminderRequest = helpers.medReminder(currentDateTime, newDateTime, freqStringList, userTimeZone, medication, reminderMsgSSML)
        
        let reminderResponse
        
        try {
            reminderResponse = await reminderApiClient.updateReminder(reminderIdList[medId].alertToken, reminderRequest)
        } catch(error) {
            console.log(`${error}`)
            return handlerInput.responseBuilder
                .speak(`There was an issue deleting the reminder for ${medication}. Please try again later.`)
                .getResponse();
        }
        
        timeList[medId] = time
        weekdayList[medId] = weekday
        reminderIdList[medId] = reminderResponse
        nextTimeList[medId] = newDateTime
        
        sessionPerson.medication = medicationList
		sessionPerson.time = timeList
		sessionPerson.weekday = weekdayList
		sessionPerson.reminderId = reminderIdList
		sessionPerson.nextTime = nextTimeList
		sessionPerson.notified = notifiedList
		sessionPerson.config = configList
		medicalAttributes[currentPersonIndex] = sessionPerson
        
        const medicationAttributes = {
            "medicalAttributes" : medicalAttributes,
			"currentPersonIndex" : currentPersonIndex
        };
        
        attributesManager.setPersistentAttributes(medicationAttributes);
        await attributesManager.savePersistentAttributes();
        
        let speakOutput
        if (helpers.dowConversion(oldWeekday).num === 7) {
            if (helpers.dowConversion(weekdayList[medId]).num === 7) {
                speakOutput = `The daily alarm at ${helpers.sayTime(oldTime)} for ${medication} has been changed to ${helpers.sayTime(timeList[medId])}. `
            } else {
                speakOutput = `The daily alarm at ${helpers.sayTime(oldTime)} for ${medication} has been changed to ${weekdayList[medId]} at ${helpers.sayTime(timeList[medId])}. `
            }
        } else {
            if (helpers.dowConversion(weekdayList[medId]).num === 7) {
                speakOutput = `The weekly alarm on ${oldWeekday} at ${helpers.sayTime(oldTime)} for ${medication} has been changed to daily at ${helpers.sayTime(timeList[medId])}. `
            } else {
                speakOutput = `The weekly alarm on ${oldWeekday} at ${helpers.sayTime(oldTime)} for ${medication} has been changed to ${weekdayList[medId]} at ${helpers.sayTime(timeList[medId])}. `
            }
        }
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('You may add, edit, or remove another alarm by telling me to do so, or exit if you are satisfied with the alarms.')
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can ask me to add, update, delete, repeat, configure, notify, check, reset config, and delete all. For further help on a topic, please say help with and then the topic you wish for further assistance in.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const FurtherHelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'FurtherHelpIntent';
    },
    handle(handlerInput) {
        const topic = handlerInput.requestEnvelope.request.intent.slots.topic.value;
        
        let speakOutput
        
        if (topic === 'add' || topic === 'Add') {
            speakOutput = 'You may add a medication by saying the medication, time, and day of the week. A sample would be "add zyrtec at 7 P. M. on friday."'
        } else if (topic === 'update' || topic === 'Update') {
            speakOutput = 'You may update a medication by giving the medication alert you wish to edit, then giving the new time, day, or both. A sample would be "update zyrtec at 7 P. M. on friday to 6 P. M. on thursday."'
        } else if (topic === 'delete' || topic === 'Delete') {
            speakOutput = 'You may delete a medication by giving the medication alert you wish to delete. If just the medication is given and there are multiple alerts for that medication, I will delete the first one I find. A sample would be "delete zyrtec at 7 P. M."'
        } else if (topic === 'repeat' || topic === 'Repeat') {
            speakOutput = 'You may ask me to repeat the list of medication alerts you already have by saying repeat.'
        } else if (topic === 'config' || topic === 'Config') {
            speakOutput = 'You may configure the number of reminders, the minutes between each reminder (minimum of 60), and the telephone number of a caregiver by saying configure.'
        } else if (topic === 'notify' || topic === 'Notify') {
            speakOutput = 'You may notify me that you have taken a medication by giving the medication, and I will text your caregiver. A sample would be "I have taken zyrtec."'
        } else if (topic === 'check' || topic === 'Check') {
            speakOutput = 'You may check whether or not you have notified me about a medication since the last time the alarm went off. A sample would be "have I taken zyrtec?"'
        } else if (topic === 'reset config' || topic === 'Reset config') {
            speakOutput = 'You may reset the config back to its default by saying "reset config". This will also get rid of the caregiver phone number so make sure you let them know.'
        } else if (topic === 'delete all' || topic === 'Delete all') {
            speakOutput = 'You may delete all reminders by saying "delete all reminders". This will ask you to confirm just to be sure.'
        }
        
        
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
        const speakOutput = "Goodbye!";
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
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
        
        const medicalAttributes = sessionAttributes.hasOwnProperty('medicalAttributes') ? sessionAttributes.medicalAttributes : 0;
		const currentPersonIndex = sessionAttributes.hasOwnProperty('currentPersonIndex') ? sessionAttributes.currentPersonIndex : -1;

        if (medicalAttributes) {
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
        RepeatMedicationIntentHandler,
        ConnectionsResponsetHandler,
        ConfigChangeIntentHandler,
        ConfigDefaultIntentHandler,
        ResetAlertsIntentHandler,
        // LaunchRequestHandler,
        HaveTakenMedicationIntentHandler,
        TakenMedicationCheckIntentHandler,
        AddMedicationIntentHandler,
        DeleteMedicationIntentHandler,
        UpdateMedicationIntentHandler,
        HelpIntentHandler,
        FurtherHelpIntentHandler,
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


