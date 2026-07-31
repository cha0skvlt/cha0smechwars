# GAME_SYS — Cha0s Mech Wars v7.3 (Unified Damage Unit)

Сводная матрица игромеханики для контроля и балансировки.  
**Канон:** [`src/config/balance.js`](src/config/balance.js) — единственный источник DU-чисел.  
**Тик:** 60 Hz. `сек ≈ frames / 60`.

---

## Damage Unit (канон)

**1 DU = 1 HP = 1 Shield = 1 Damage.**  
Одна физика для игрока, бота и монстров.

| Правило | Деталь |
| --- | --- |
| Формула оружия | `dmg = WEAPONS[wep].damage × weaponLevel` (любой стрелок) |
| Скорость пуль | `WEAPONS[wep].speed` — без урезания для врагов |
| Shield absorb | 1:1 clamp; остаток → HP |
| Shield regen | `SHIELD.regenRate` (**180** f) — единый; только при `shield > 0` |
| Crit | ×2 поверх DU (только урон игрока по врагам) |
| Quad | ×4 поверх DU |
| Читатели | `Bullet.js`, `Player.js`, `Enemy.js`, `Game.js`, `Turret.js` |

---

## 0. Глобальные

| Параметр | Значение |
| --- | --- |
| Карта | 3000×3000 |
| Сетка | 128 |
| Enemy cap | 50 / calm 30 |
| Loot drop | 20% |
| Loot life | 800 f |
| hpMult | `1 + floor(wave/10)×0.1` |
| Combo window | 60 f |

---

## 1. МЕХИ (DU)

| | battle | heavy | scout |
| --- | --- | --- | --- |
| HP | 12 | 18 | 10 |
| Max Shield | 6 | 12 | 4 |
| Pool (HP+SH) | 18 | 30 | 14 |
| Speed | 4.5 | 3.5 | 5.0 |
| Shield regen | +1 / **180** f (глобальный `SHIELD.regenRate`) | same | same |
| Fuel | 100 jet | dash 0→50 | 300 jet |
| Jet mult | 1.5 | — | 2.0 |
| Dash | — | dmg **3 DU**, 8 f, inv 12 | — |

I-frames: shield hit 20 f / HP hit 30 f.  
Цвет щита: игрок cyan; бот красный.

---

## 2. ОРУЖИЕ (DU) — общее для всех

| Weapon | baseDamage | L1 hit | Speed | Size | Life |
| --- | --- | --- | --- | --- | --- |
| pistol | 1 | 1 | 15 | 6×6 | 100 |
| shotgun | 1/pellet | 1 | 15 | 6×6 | 100 |
| mg | 1 | 1 | 15 (L3+ ×1.5) | 6×6 | 100 |
| laser | 2 | 2 | 30 | 30×2 / L3 45×3 | 100 |
| rpg | 3 | 3 | 8 | 8×8 | 100 |

Fire rate: `CD = max(minCd, baseCd − (lvl−1))`; Overclock ×0.5.

| Weapon | Base CD | Min CD | L1 DPS |
| --- | --- | --- | --- |
| pistol | 18 | 5 | 3.33 |
| shotgun | 45 | 20 | 8.0 (6 pellets) |
| mg | 6 | 2 | 10.0 |
| laser | 50 | 30 | 2.4 (+ penetrate) |
| rpg | 80 | 40 | 2.25 (+ splash) |

RPG splash: close≤30 → 2; mid≤50 → 1; far → 1.

### Named events (`DAMAGE`)

| Event | DU |
| --- | --- |
| contact | 1 |
| dash / emp | 3 |
| explodeFriend / VsMech | 4 |
| explode*Push / explodeEnemyVsMech | 1 |
| repair / shield pickup | +3 |

---

## 3. ВРАГИ — HP / щит / оружие

| Type | HP | Shield | Pool | weapons | contact | Unlock | TTK pistol* |
| --- | --- | --- | --- | --- | --- | --- | --- |
| zombie | 2 | 0 | 2 | — | 1 | always | 0.6 s |
| stalker | 3 | 0 | 3 | — | 1 | >2 | 0.9 s |
| gunner | 4 | 0 | 4 | pistol | 1 | >1 (×2) | 1.2 s |
| rocketman | 5 | 0 | 5 | rpg | 1 | >3 | 1.5 s |
| commando | 7 | **3** | 10 | mg | 1 | >4 | ~3.0 s |
| tank | 20 | **10** | 30 | shotgun | 1 | >5 (×3) | ~9.0 s |
| sniper | 1 | **1** | 2 | laser | 1 | ≥6 | 0.6 s |
| mantis | 150 | 0 | 150 | shotgun | 1 | wave%10 forest | 45 s |
| fortress | 250 | 0 | 250 | mg, rpg | 1 | wave%10 ruins | 75 s |
| eye | 130 | 0 | 130 | laser | 1 | wave%10 dungeon | 39 s |

\*TTK @ pistol 3.33 DU/s без crit, без учёта регена щита. HP × `hpMult`.

**Щит монстров:** реген +1 / 180 f только если `shield > 0` (sniper после 1 хита — без регена). Цвет кольца = цвет моба (`this.c`).

### 3b. Исходящий урон (vs мех)

Одна физика: hit DU = `WEAPONS[wep].damage` при lvl 1.

| Type | Attack | Hit DU | Pattern |
| --- | --- | --- | --- |
| zombie / stalker | contact | 1 | melee |
| gunner | pistol | 1 | CD 120 |
| rocketman | rpg ×2 | 3 | CD 180 dual |
| tank | shotgun fan | 1/pellet | CD 150 |
| commando | mg | 1 | burst |
| sniper | laser | 2 | windup→shot |
| mantis | shotgun | 1/pellet | charge cycle |
| fortress | mg + rpg | 1 / 3 | mg/10, rpg/120 |
| eye | laser | 2 | /60 |

I-frames меха (20/30) схлопывают залп в один эффективный хит за окно — общая физика попадания по игроку.

Хитов до пустого battle (18), один источник без регена:

| Source | DU/hit | Hits |
| --- | --- | --- |
| contact / pistol / mg / sg volley | 1 | 18 |
| laser | 2 | 9 |
| rpg | 3 | 6 |

### AI timings (без смены в этом проходе)

| Type | Notes |
| --- | --- |
| gunner | band 150–250; fire <400 |
| rocketman | band 300–500; fire <600 |
| tank | fire <350 |
| sniper | prefer 450–600 |
| commando | dodge r80 / cool 120 |
| mantis | rage <50% HP |
| eye | orbit 250 |

---

## 4. ЛУТ / МОДУЛИ / ВОЛНЫ

Loot 18 slots; modules turret/warp/emp/grav/overclock — см. `balance.js`.  
Wave 1200 f; boss every 10; spawn `max(20, 60−wave×2)`.

---

## 5. Файлы канона

| Concern | Path |
| --- | --- |
| All numbers | `src/config/balance.js` |
| Bullets | `src/entities/Bullet.js` |
| Mech / shield regen | `src/entities/Player.js` |
| Enemy weapons / shields | `src/entities/Enemy.js` |
| dmg absorb / contact | `src/game/Game.js` |

---

## 6. Чеклист баланса

1. Числа — только в `balance.js`.
2. Оружие OP? → `WEAPONS.*`
3. Монстр танк? → `ENEMIES.*.hp` / `shield`
4. Исходящий? → тот же `WEAPONS` + AI interval (не отдельная таблица урона)
5. После правки — сверить эту матрицу.

---

*One physics DU. При расхождении — верить `balance.js`.*
