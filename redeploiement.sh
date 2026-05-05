#!/bin/bash

export NVM_DIR="/home/ubuntu/.nvm"
export PATH="$NVM_DIR/versions/node/v22.22.2/bin:$PATH"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "======== $(date) | Déploiement PokéLudik ========"

cd /home/ubuntu/PokeLudik || exit 1

echo "Mise à jour du dépôt Git..."
git pull origin

echo "Installation des dépendances..."
npm install

echo "Lancement du build..."
npm run build

echo "======== Déploiement terminé avec succès ========"
