set -eu
umask 077
: "${MONGO_INITDB_ROOT_USERNAME:?MongoDB username is required}"
: "${MONGO_INITDB_ROOT_PASSWORD:?MongoDB password is required}"
# Render overrides the image ENTRYPOINT when dockerCommand is set. Bootstrap
# locally with authorization enabled; MongoDB's localhost exception permits only
# the first administrator. Existing users/passwords are never reset or removed.
mongod --auth --bind_ip 127.0.0.1 --port 27017 --dbpath /data/db --wiredTigerCacheSizeGB 0.25 --fork --logpath /tmp/demstav-mongo-bootstrap.log
trap 'mongod --shutdown --dbpath /data/db >/dev/null 2>&1 || true' EXIT
mongosh --norc --quiet mongodb://127.0.0.1:27017/admin --eval "$(cat <<'JS'
const admin = db.getSiblingDB("admin");
let authenticated = false;
try {
  authenticated = !!admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD);
} catch (_) {}
if (!authenticated) {
  admin.createUser({user: process.env.MONGO_INITDB_ROOT_USERNAME, pwd: process.env.MONGO_INITDB_ROOT_PASSWORD, roles: [{role: "root", db: "admin"}]});
}
if (!admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) {
  throw new Error("MongoDB bootstrap authentication failed");
}
JS
)"
mongod --shutdown --dbpath /data/db
trap - EXIT
exec /usr/local/bin/docker-entrypoint.sh mongod --auth --port 10000 --bind_ip_all --wiredTigerCacheSizeGB 0.25
