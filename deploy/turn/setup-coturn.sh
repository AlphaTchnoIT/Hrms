#!/usr/bin/env bash
#
# Installs coturn (open-source TURN/STUN server) for chat audio calls on a fresh Ubuntu server.
# Voice only passes through it when the two browsers cannot reach each other directly.
#
# Usage (on the server):
#   sudo bash setup-coturn.sh <domain> <secret>
#   e.g. sudo bash setup-coturn.sh turn.example.com "$(openssl rand -hex 32)"
#
# Then set on the HRMS backend (.env):
#   STUN_URLS=stun:<domain>:3478
#   TURN_URLS=turn:<domain>:3478?transport=udp,turn:<domain>:3478?transport=tcp
#   TURN_SECRET=<same secret>
#
# Cloud firewall (e.g. Oracle "Security List") must also allow:
#   TCP 3478, UDP 3478, UDP 49160-49200
set -euo pipefail

DOMAIN="${1:-}"
SECRET="${2:-}"
MIN_PORT=49160
MAX_PORT=49200

if [[ -z "$DOMAIN" || -z "$SECRET" ]]; then
  echo "Usage: sudo bash $0 <domain> <secret>" >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo" >&2
  exit 1
fi

PRIVATE_IP="$(hostname -I | awk '{print $1}')"
PUBLIC_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1 {print $1}')"
if [[ -z "$PUBLIC_IP" ]]; then
  echo "$DOMAIN does not point to this server yet. Add the DNS A record first, wait a few minutes, then run again." >&2
  exit 1
fi
echo "Domain $DOMAIN -> public IP $PUBLIC_IP, private IP $PRIVATE_IP"

apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y coturn iptables-persistent

cat > /etc/turnserver.conf <<EOF
# Written by setup-coturn.sh
listening-port=3478
listening-ip=$PRIVATE_IP
relay-ip=$PRIVATE_IP
external-ip=$PUBLIC_IP/$PRIVATE_IP
min-port=$MIN_PORT
max-port=$MAX_PORT

# Short-lived logins made by the HRMS backend (TURN_SECRET), no fixed passwords
use-auth-secret
static-auth-secret=$SECRET
realm=$DOMAIN
server-name=$DOMAIN
fingerprint

no-cli
no-tls
no-dtls
no-multicast-peers

# Never relay into private networks (protects the server's own network)...
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
# ...except this server itself, for calls where both sides use TURN
allowed-peer-ip=$PRIVATE_IP

total-quota=100
user-quota=12
stale-nonce=600
log-file=syslog
simple-log
EOF

# Older Ubuntu packages only start coturn when this is set
if [[ -f /etc/default/coturn ]]; then
  sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
fi

# Ubuntu images on Oracle Cloud block everything except SSH in iptables
add_rule() { iptables -C INPUT "$@" -j ACCEPT 2>/dev/null || iptables -I INPUT "$@" -j ACCEPT; }
add_rule -p tcp --dport 3478
add_rule -p udp --dport 3478
add_rule -p udp --dport "$MIN_PORT:$MAX_PORT"
netfilter-persistent save

systemctl enable coturn
systemctl restart coturn
sleep 2
systemctl is-active --quiet coturn && echo "coturn is running on $DOMAIN:3478" || { journalctl -u coturn -n 30 --no-pager; exit 1; }
