# Suivi d'ouverture des mails (Vercel + Upstash Redis + Discord)

Variables d'environnement (Vercel > Settings > Environment Variables) :
- DISCORD_WEBHOOK_URL : webhook du salon Discord (obligatoire)
- ADMIN_KEY           : longue chaîne aléatoire qui protège /admin (obligatoire)
- Redis Upstash       : ajouté automatiquement via Vercel > Storage > Upstash Redis
                        (UPSTASH_REDIS_REST_URL/TOKEN ou KV_REST_API_URL/TOKEN)

Optionnelles :
- OWN_IPS=ip1,ip2     : tes IP fixes, ignorées
- REOPEN_MIN=15       : minutes minimum entre deux alertes pour un même mail
- FAST_SECONDS=90     : ouverture plus rapide que ça après création = douteuse
- NOTIFY_SUSPECT=0    : ne pas alerter sur les ouvertures douteuses
- NOTIFY_BOT=1        : alerter aussi sur les robots

Usage : ouvre https://TON-APP.vercel.app/admin?key=TA_CLE, crée un pixel par mail,
colle le code HTML dans le corps du mail.
