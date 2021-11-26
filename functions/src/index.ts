import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
admin.initializeApp();

const db = admin.firestore();

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript

// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

export const onCreateAssignment = functions.firestore
    .document("assignments/{id}").onCreate(async (snap, context) => {
      try {
        const assignmentId = context.params.id;
        const assignmentName = snap.get("name");
        const posterId = snap.get("poster.id") as string;
        const channelId = snap.get("group.id");
        const channels = await db.collectionGroup("channels")
            .where("id", "==", channelId).get();

        const promises: any[] = [];
        channels.forEach((channel) => {
          const channelMembers = channel.get("members") as string[];
          const currentChannelId = channel.get("id");
          const currentChannelName = channel.get("name");
          const currentChannelImage = "";

          for (const member of channelMembers) {
            if (member != posterId) {
              promises.push(
                  db.collection(`users/${member}/userAssignments`)
                      .doc(assignmentId).create({
                        name: assignmentName,
                        group: {
                          id: currentChannelId,
                          name: currentChannelName,
                          image: currentChannelImage,
                        },
                        delivered: false,
                        responseId: null,
                      })
              );
            }
          }

          return Promise.all(promises);
        });
      } catch (error) {
        console.log(error);
      }

      return null;
    });

/**
 *
 * @param {string} name - name
 * @return {string[]}
 */
function createKeywords(name : string) : string[] {
  const keywords : string[] = [];
  let currentName = "";
  name.split("").forEach((letter) => {
    currentName += letter;
    keywords.push(currentName);
  });
  return keywords;
}

export const onCreateUser = functions.firestore
    .document("users/{id}")
    .onCreate((snap, context) => {
      const fullname = `${snap.get("name")} ${snap.get("lastname")}`;
      const keywords = createKeywords(fullname.toLowerCase());

      return snap.ref.set({
        keywords: keywords,
      }, {merge: true});
    });

export const onCreateAssignmentResponse = functions.firestore
    .document("assignments/{assignmentId}/assignmentResponses/{id}")
    .onCreate(async (snap, context) => {
      try {
        const userId = snap.get("user.id");
        const assignmentId = context.params.assignmentId;
        console.log(`Assignment Id: ${assignmentId}`);

        const assignment = await db.doc(`assignments/${assignmentId}`).get();
        const assignmentScore = assignment.get("score") as number;
        console.log(`Score ${assignmentScore}`);

        return db.doc(`users/${userId}`).update({
          score: admin.firestore.FieldValue.increment(assignmentScore),
        });
      } catch (error) {
        console.log(error);
      }

      return null;
    });

/**
 *
 * @param {number} score - User Score
 * @return {string}
 */
function getBadge(score : number) : string {
  const badges = [
    {
      name: "Entregador",
      minScore: 200,
    },
    {
      name: "Cumplido",
      minScore: 300,
    },
    {
      name: "Responsable",
      minScore: 500,
    },
    {
      name: "Comprometido",
      minScore: 1000,
    },
    {
      name: "Apasionado",
      minScore: 5000,
    },
    {
      name: "Maestro",
      minScore: 10000,
    },
  ];

  let resultBadge = "";
  for (const badge of badges) {
    if (score < badge.minScore) {
      break;
    }

    resultBadge = badge.name;
  }

  return resultBadge;
}

export const onUpdateUser = functions.firestore
    .document("users/{id}")
    .onUpdate((change, context) => {
      const userScoreBefore = change.before.get("score") as number;
      const userScoreAfter = change.after.get("score") as number;

      if (userScoreBefore != userScoreAfter) {
        const badge = getBadge(userScoreAfter);
        if (badge != "") {
          return change.after.ref.update({
            badges: admin.firestore.FieldValue.arrayUnion(badge),
          });
        }
      }

      return null;
    });
