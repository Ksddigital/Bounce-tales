const CANVAS_W = 800;
const CANVAS_H = 450;
const TILE = 40;

const GRAVITY = 0.55;
const FRICTION = 0.88;
const MAX_SPEED = 9;
const JUMP_FORCE = -13;
const MOVE_SPEED = 0.5;
const BOUNCE_FACTOR = 0.35;

const PLAYER_RADIUS = 16;

const FORM_BOUNCE = 'bounce';
const FORM_BUMPY = 'bumpy';
const FORM_WOLLY = 'wolly';

const FORM_CONFIG = {
  [FORM_BOUNCE]: { radius: 16, speed: 0.5, jump: -13, gravity: 0.55, maxSpeed: 9, color: '#E53935', label: 'Bounce' },
  [FORM_BUMPY]: { radius: 20, speed: 0.42, jump: -12.5, gravity: 0.65, maxSpeed: 7.8, color: '#5D4037', label: 'Bumpy' },
  [FORM_WOLLY]: { radius: 14, speed: 0.55, jump: -17, gravity: 0.35, maxSpeed: 11, color: '#F5F5F5', label: 'Wolly' }
};

const STATE_MENU = 'menu';
const STATE_PLAYING = 'playing';
const STATE_PAUSED = 'paused';
const STATE_LEVEL_COMPLETE = 'levelComplete';
const STATE_GAME_OVER = 'gameOver';
const STATE_WIN = 'win';
const STATE_TRANSITION = 'transition';

const KONAMI_CODE = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
const MILKYWAY_CODE = ['KeyM','KeyI','KeyL','KeyK','KeyY','KeyW','KeyA','KeyY'];
const MAX_CHEAT_BUFFER = 12;

const COLORS = {
  sky1: '#87CEEB',
  sky2: '#4FC3F7',
  ground: '#4CAF50',
  groundDark: '#388E3C',
  spike: '#B71C1C',
  gate: '#795548',
  gateOpen: '#546E7A',
  key: '#FFD600',
  exit: '#00E676',
  platform: '#66BB6A',
  stone: '#78909C',
  cloud: '#ECEFF1',
  lava: '#FF5722',
  egg: '#FFC107',
  life: '#E91E63',
  particle: '#FFE082',
  ui: '#FFFFFF',
  fly: '#00E5FF',
  trampoline: '#42A5F5',
  enemy: '#7B1FA2',
  fireball: '#FF6D00',
  invul: '#FFD600',
  laser: '#F44336',
  laserInactive: 'rgba(244,67,54,0.2)',
  airWall: '#B0BEC5',
  fuelBar: '#00E5FF',
  windColumn: 'rgba(224, 247, 250, 0.15)',
  weightSwitch: '#8D6E63',
  weightSwitchPressed: '#4E342E',
  dashPad: '#FFEB3B',
  boss: '#D500F9',
  bossBomb: '#FF3D00',
  water: 'rgba(0, 188, 212, 0.45)',
  shield: '#29B6F6',
  speedShoes: '#FF7043',
  gateSize: '#E040FB'
};

const TRAMPOLINE_BOUNCE = -18;
const FIREBALL_SPEED = 12;
const FIREBALL_COOLDOWN = 30;
const INVUL_DURATION = 900;
const INVUL_COOLDOWN = 600;
const FLIGHT_FUEL_MAX = 200;
const FLIGHT_FUEL_DRAIN = 0.2;
const FLIGHT_FUEL_RECHARGE = 0.1;
const LASER_TOGGLE_INTERVAL = 180;
const AIR_MAZE_REVEAL_Y = 400;
const ENEMY_SPEED = 1.2;

const KEYS = {};
let FLY_CHEAT_UNLOCKED = localStorage.getItem('bt_fly_unlocked') === 'true';
const IS_MOBILE = window.matchMedia('(pointer: coarse)').matches || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const SHADOWS_ENABLED = !IS_MOBILE;
