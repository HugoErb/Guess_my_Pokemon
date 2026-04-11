# Guess my Pokémon

Un jeu multijoueur en temps réel où deux joueurs s'affrontent pour deviner le Pokémon choisi par l'adversaire.

## Le projet

**Guess my Pokémon** est une application web de type "devine le Pokémon de l'autre". Chaque joueur choisit secrètement un Pokémon dans son Pokédex, puis les deux joueurs s'affrontent pour deviner lequel l'autre a sélectionné.

### Fonctionnalités principales

- **Authentification** — Connexion via Supabase (email/mot de passe ou OAuth)
- **Création de salon** — Un joueur crée une room et invite un ami via un lien
- **Lobby** — Les deux joueurs se retrouvent et confirment leur présence avant de démarrer
- **Sélection secrète** — Chaque joueur choisit un Pokémon dans son Pokédex sans que l'adversaire ne le voie
- **Partie en temps réel** — La room est synchronisée en temps réel grâce aux Realtime subscriptions de Supabase
- **Pokédex intégré** — Interface de sélection avec les Pokémons disponibles

### Stack technique

| Technologie | Rôle |
|-------------|------|
| **Angular 21** | Framework frontend (standalone components, signals) |
| **Supabase** | Backend as a service : base de données PostgreSQL, authentification, temps réel |
| **TailwindCSS** | Styles utilitaires |
| **TypeScript** | Typage statique |

---

## Lancer le projet

### Prérequis

- [Node.js](https://nodejs.org/) v18 ou supérieur
- npm (inclus avec Node.js)
- Un projet Supabase configuré (voir ci-dessous)

### Installation

```bash
# Cloner le dépôt
git clone <url-du-repo>
cd "Guess my pokemon"

# Installer les dépendances
npm install
```

### Configuration Supabase

Créez un fichier `src/environments/environment.ts` avec vos clés Supabase :

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://VOTRE_PROJET.supabase.co',
  supabaseKey: 'VOTRE_CLE_ANON_PUBLIQUE'
};
```

### Démarrer le serveur de développement

```bash
npm start
# ou
ng serve
```

L'application sera disponible sur [http://localhost:4200](http://localhost:4200).  
Elle se recharge automatiquement à chaque modification de fichier source.

### Générer les données Pokémon

Un script fetch les données depuis l'API PokéAPI et les prépare pour l'application :

```bash
npm run generate:pokemon
```

---