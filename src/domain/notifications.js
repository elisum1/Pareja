const { randomUUID } = require("crypto");
const { dbQuery } = require("../db");

const NOTIFICATION_TYPES = new Set([
  "invite_received",
  "invite_accepted",
  "partner_test_completed",
  "partner_test_updated"
]);

function displayNameFromRow(row) {
  if (!row) return "Alguien";
  const name = String(row.display_name || row.displayName || "").trim();
  if (name) return name.split(/\s+/)[0];
  const username = String(row.username || "").trim();
  if (username) return `@${username}`;
  const email = String(row.email || "").trim();
  if (email) return email.split("@")[0];
  return "Alguien";
}

async function getUserDisplayName(userId) {
  const rows = await dbQuery(
    "select display_name, username, email from app_user where id=? limit 1",
    [userId]
  );
  return displayNameFromRow(rows[0]);
}

async function getLinkedPartnerIds(userId) {
  const rows = await dbQuery(
    "select user_a_id, user_b_id from couple where user_a_id=? or user_b_id=?",
    [userId, userId]
  );
  const set = new Set();
  for (const row of rows) {
    const partnerId = row.user_a_id === userId ? row.user_b_id : row.user_a_id;
    if (partnerId && partnerId !== userId) set.add(partnerId);
  }
  return [...set];
}

async function createNotification({ userId, type, title, body, actorUserId = null, data = {} }) {
  if (!userId || !NOTIFICATION_TYPES.has(type)) return null;
  if (actorUserId && actorUserId === userId) return null;

  const id = randomUUID();
  await dbQuery(
    `insert into app_notification (id, user_id, type, title, body, actor_user_id, data_json)
     values (?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, type, title, body, actorUserId, JSON.stringify(data ?? {})]
  );
  return id;
}

async function notifyInviteReceived({ targetUserId, inviterUserId, inviteId, inviteToken }) {
  const name = await getUserDisplayName(inviterUserId);
  return createNotification({
    userId: targetUserId,
    type: "invite_received",
    title: "Invitación al test",
    body: `${name} te invitó a realizar el test de compatibilidad en Metriclove.`,
    actorUserId: inviterUserId,
    data: { inviteId, inviteToken }
  });
}

async function notifyInviteAccepted({ inviterUserId, acceptedUserId, coupleId, inviteId }) {
  const name = await getUserDisplayName(acceptedUserId);
  return createNotification({
    userId: inviterUserId,
    type: "invite_accepted",
    title: "Invitación aceptada",
    body: `${name} aceptó tu invitación. Ya están vinculados para hacer el test juntos.`,
    actorUserId: acceptedUserId,
    data: { coupleId, inviteId, partnerUserId: acceptedUserId }
  });
}

async function notifyPartnersTestChange({ userId, isUpdate }) {
  const partnerIds = await getLinkedPartnerIds(userId);
  if (!partnerIds.length) return;

  const name = await getUserDisplayName(userId);
  const type = isUpdate ? "partner_test_updated" : "partner_test_completed";
  const title = isUpdate ? "Test actualizado" : "Test completado";
  const body = isUpdate
    ? `${name} volvió a hacer el test de pareja. Revisa si cambió la compatibilidad entre ustedes.`
    : `${name} terminó el test de pareja. Ya puedes ver la comparativa en Resultados.`;

  await Promise.all(
    partnerIds.map((partnerId) =>
      createNotification({
        userId: partnerId,
        type,
        title,
        body,
        actorUserId: userId,
        data: { partnerUserId: userId }
      })
    )
  );
}

function mapNotificationRow(row) {
  let data = {};
  try {
    data = JSON.parse(row.data_json || "{}");
  } catch {
    data = {};
  }
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    read: Boolean(row.read_at),
    createdAt: row.created_at,
    readAt: row.read_at || null,
    actor: row.actor_user_id
      ? {
          id: row.actor_user_id,
          displayName: row.actor_display_name || null,
          username: row.actor_username || null,
          photoUrl: row.actor_photo_url || null
        }
      : null,
    data
  };
}

module.exports = {
  NOTIFICATION_TYPES,
  displayNameFromRow,
  getUserDisplayName,
  getLinkedPartnerIds,
  createNotification,
  notifyInviteReceived,
  notifyInviteAccepted,
  notifyPartnersTestChange,
  mapNotificationRow
};
