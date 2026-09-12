const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();

exports.definirCargo = onCall({ cors: true }, async (request) => {
  // =================================================================
  const EMAIL_DO_DONO = "lucasscortizo@gmail.com"; 
  // =================================================================

  const auth = request.auth;
  const data = request.data;

  const isDono = auth && auth.token.email === EMAIL_DO_DONO;
  const isAdmin = auth && auth.token.role === 'admin';

  if (!isDono && !isAdmin) {
    throw new HttpsError(
      'permission-denied', 
      'Apenas administradores podem alterar cargos.'
    );
  }

  const { uid, novoCargo } = data;

  try {
    await admin.auth().setCustomUserClaims(uid, { role: novoCargo });
    await admin.firestore().collection('usuarios').doc(uid).update({ 
      role: novoCargo 
    });

    return { message: `Sucesso! O usuário agora é ${novoCargo}` };
  } catch (error) {
    throw new HttpsError('internal', 'Erro ao alterar cargo.');
  }
});