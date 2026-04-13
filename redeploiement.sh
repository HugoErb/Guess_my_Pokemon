#!/bin/bash

# Charger NVM et rendre npm/pm2 disponibles dans un contexte systemd
export NVM_DIR="/home/ubuntu/.nvm"
export PATH="$NVM_DIR/versions/node/v22.22.2/bin:$PATH"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Sortie console + fichier log
exec > >(tee -a /home/ubuntu/Guess_my_Pokemon/redeploy.log) 2>&1
echo "======== $(date) | Déploiement de Guess my Pokemon démarré ========"

# Aller dans le bon dossier
cd /home/ubuntu/Guess-my-Pokemon || exit 1

# Variables
nomApplication="Guess-my-Pokemon"
NPM_CMD=$(which npm)
PM2_CMD=$(which pm2)

if [ -z "$NPM_CMD" ] || [ -z "$PM2_CMD" ]; then
    echo "Erreur : npm ou pm2 est introuvable dans l'environnement NVM"
    exit 1
fi

# Mise à jour du dépôt
echo "Mise à jour du dépôt Git..."
git pull origin

# Installation des dépendances
echo "Installation des dépendances..."
$NPM_CMD install

# Build
echo "Lancement du build..."
$NPM_CMD run build

# Lancement/redémarrage avec PM2
echo "(Re)démarrage de l'application '$nomApplication' via PM2..."
$PM2_CMD startOrRestart ecosystem_production.config.js --only "$nomApplication"

if $PM2_CMD describe "$nomApplication" > /dev/null; then
    echo "Application '$nomApplication' active après startOrRestart."
else
    echo "Erreur : L'application '$nomApplication' n'a pas pu être lancée."
    exit 1
fi

echo "======== Déploiement de Guess my Pokemon terminé avec succès ========"