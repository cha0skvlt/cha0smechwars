# GAME_SYS — Cha0s Mech Wars v8.0 "Lance Update" (Unified Damage Unit)

Сводная матрица игромеханики для контроля и балансировки.  
**Канон:** [`src/config/balance.js`](src/config/balance.js) — единственный источник DU-чисел.  
**Тик:** 60 Hz. `сек ≈ frames / 60`.

---

## Damage Unit (канон)

**1 DU = 1 HP = 1 Shield = 1 Damage = 1 CE (Combat Experience).**  
Одна физика для игрока, бота и монстров.

| Правило | Деталь |
| --- | --- |
| Формула оружия | `dmg = WEAPONS[wep].damage × weaponLevel` (любой стрелок) |
| Скорость пуль | `WEAPONS[wep].speed` — без урезания для врагов |
| Shield absorb | 1:1 clamp; остаток → HP |
| Shield regen | `SHIELD.regenRate` (**180** f) — единый; только при `shield > 0` |
| Crit | ×2 поверх DU (только урон игрока по врагам) |
| Quad | ×4 поверх DU |
| Bastion Shield | союзник в радиусе щита heavy — урон целиком идёт в HP/Shield носителя щита (та же 1:1 физика) |
| Читатели | `Bullet.js`, `Player.js`, `Enemy.js`, `Game.js`, `Turret.js` |

---

## 0. Глобальные

| Параметр | Значение |
| --- | --- |
| Карта | 3000×3000 |
| Сетка | 128 |
| Enemy cap | 50 |
| Loot drop | 20% |
| Loot life | 800 f |
| hpMult | `1 + floor(wave/10)×0.1` |
| Combo window | 60 f |
| Копье (Lance) | 3 меха на сторону — см. секцию **LANCE** |

---

## 1. МЕХИ (DU)

| | battle | heavy | scout |
| --- | --- | --- | --- |
| HP | 12 | 18 | 10 |
| Max Shield | 6 | 12 | 4 |
| Pool (HP+SH) | 18 | 30 | 14 |
| Speed | 4.5 | 3.5 | 5.0 |
| Shield regen | +1 / **180** f (глобальный `SHIELD.regenRate`) | same | same |
| Fuel | 100 jet | 100, Juggernaut Dash drain | 300 jet |
| Jet mult | 1.5 | — | 2.0 |
| Ability | [SPACE] jetpack | **Juggernaut Dash** (see below) | [SPACE] jetpack (Perma-Flight upgrade inverts it) |
| Модуль | турель по дефолту (Shift, без подбора) | — | — |

**Juggernaut Dash (heavy, v8 redesign):** наземный рывок, держишь SPACE — едешь, топливо тратится по кадрам (`MECHS.heavy.dashFuelDrain`, дефолт 1.5/f), отпустил/кончилось топливо — рывок останавливается. Contact-урон по пути (`DAMAGE.dash` 3 DU, upgrade Mk.2 → `DAMAGE.dashMk2` 5 DU). Во время рывка иммунитет только к CONTACT-каналу урона (монстры/мехи впритык); пули и взрывы пробивают. После рывка — `dashPostInv` (12 f) обычной неуязвимости. Seismic Slam (upgrade) добавляет ударную волну в момент остановки рывка.

**Perma-Flight (scout, upgrade-режим, ветка Scout):** инверсия жетпака — по умолчанию в полёте, SPACE = приземлиться. Топливо тратится в полёте (стандартный `fuelDrain`), восстанавливается на земле (стандартный `fuelRegen`). Без апгрейда — обычный джетпак (SPACE = взлёт).

I-frames: shield hit 20 f / HP hit 30 f.  
Цвет щита: игрок cyan; бот красный. Bastion Shield (heavy upgrade) — визуальный радиус щита ×2 (`HEAVY_ABILITIES.bastionShieldRadiusMult`).

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

### Battle turret variants (v8)

Турель убрана из loot-модулей — battle несёт её по умолчанию (Shift, `moduleCd` = 0 на старте миссии, `MODULE_COOLDOWN.turret` = 900f). Варианты покупаются в Магазине (ветка Battle) и меняют барабан турели; урон — из общей таблицы `WEAPONS`, отдельной таблицы нет.

| Variant | Weapon | Barrels | Fire CD | Source |
| --- | --- | --- | --- | --- |
| mg (default) | mg | 1 | 10 f | free, all battle mechs |
| rocket | rpg | 2 | 26 f | `TACTICAL_UPGRADES.battle.turretRocket` (140 CE) |
| laser | laser | 2 | 22 f | `TACTICAL_UPGRADES.battle.turretLaser` (130 CE) |

### Named events (`DAMAGE`)

| Event | DU |
| --- | --- |
| contact | 1 |
| dash | 3 |
| dashMk2 (Juggernaut Dash Mk.2 upgrade) | 5 |
| emp | 3 |
| explodeFriend / VsMech | 4 |
| explode*Push / explodeEnemyVsMech | 1 |
| repair / shield pickup | +3 |
| seismicSlam (Seismic Slam upgrade shockwave, r100) | 6 |

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

**Rival lance AI-приоритет целей (v8):** боевые мехи бота выбирают цель по приоритету **boss > мехи игрока > монстры** (см. секцию **RIVAL**), а не просто по расстоянию — реализовано в `BotController.js` для `faction === 'rival'`.

---

## 4. ЛУТ / МОДУЛИ / БОНУСЫ / ВОЛНЫ

Loot 17 slots; modules warp/emp/grav/overclock (turret убран — battle несёт его по дефолту, см. секцию 2).  
Wave 1200 f; boss на wave 10; spawn `max(20, 60−wave×2)`. Миссия завершается на первой смерти босса (см. секцию **МИССИЯ**) — нет бесконечных волн/смены биома внутри миссии.

### Бонусы (`pows`)

| Bonus | Char | Effect |
| --- | --- | --- |
| repair | A | +3 HP |
| shield | O | +3 Shield |
| quad | Q | ×4 dmg, 240f |
| freeze | Z | freeze enemies, 240f |
| **resurrect** | **V** | воскрешает 1 случайного мёртвого меха СВОЕГО копья (полный HP, 0 shield, 90f inv); подбор при полном копье — denial, бонус исчезает без эффекта; работает для игрока и бота |
| shotgun/mg/rpg/laser | S/M/R/L | weapon pickup/level |
| warp/emp/grav/overclock | E | module pickup |

**"+1 союзник" убран из перков за уровень полностью** (`UPGRADES.companionProtocol` удалён из `progression.js`/`balance.js`) — воскрешение живёт только как бонус-дроп `resurrect`, вне левелинга.

---

## 5. LANCE (v8)

- Обе стороны — **копьё (Lance) из 3 мехов** (`BALANCE.LANCE.size`), любое сочетание battle/heavy/scout, дубли разрешены.
- **Игрок**: управляет одним мехом (острие), два других — AI-FOLLOW (`BotController`). Свитч — клавиша **C**, циклически по живым мехам. Покинутый мех мгновенно переходит под AI; при смерти управляемого — авто-переход на следующего живого (`Game.handleControlledMechDeath`). Свитч заблокирован, пока висит выбор перка уровня (перк принадлежит мехy, который левелапнулся).
- **Левелинг**: каждый мех копья — свой уровень/CE отдельно, обнуляется в начале каждой миссии (level 1). AI-мехи авто-выбирают перк (`grantAiProgress`); управляемый вручную выбирает через оверлей.
- **Бот**: копьё из 3 случайных классов (`randomLanceComposition`), не респавнится. Полный вайп копья бота = на этой миссии больше нет вражеских мехов (`getMechs()` просто перестаёт включать мёртвых); все волны и босс достаются игроку.
- **Формация — треугольник** (`formationSlotTarget` в `botTactics.js`): лидер (человек у игрока / первый живой у бота) на острие, слоты 1/2 — позади лидера, развёрнуты по `LANCE.triangleAngle` (0.6 rad) на `LANCE.triangleSpacing` (90px).
- **FOLLOW-радиусы**: `LANCE.followRadiusSq` (220²) — начинает подтягиваться; `LANCE.leashRadiusSq` (420²) — жёсткий возврат в строй, боевые действия прерываются. Ведомый мех дерётся в контакте, но не убегает дальше радиуса формации (при бое за пределами follow-радиуса движение смешивается 50/50 с вектором возврата в строй).
- **Formation Tactics** (общая ветка, покупка) — переключает оба радиуса на `tightFollowRadiusSq`/`tightLeashRadiusSq` (90²/156²), жёсткий строй для прикрытия Bastion Shield.
- **Спавн**: оба копья стартуют в противоположных (не смежных) углах карты 3000×3000, отступ `LANCE.cornerMargin` (260px), лицом друг к другу.
- **Смерть**: мехи НЕ респавнятся сами; мёртвый мех — труп до конца миссии либо до подбора бонуса `resurrect` своим копьём. Смерть всех 3 мехов игрока = провал миссии (`resolveMissionEnd('wipe')`) — **не сброс прогона**: кошелёк CE, streak'и и тактические апгрейды переживают вайп (см. секцию 6, "непотраченный CE не сгорает"). Показывается recap-экран (`showLanceWipeSummary`, кили/CE рана, submit в `HighScores`), кнопка `[RETURN TO LANCE HUB]` (`continueAfterWipe`) возвращает в Lance Hub с тем же кошельком.

---

## 6. COMBAT EXPERIENCE (v8)

**Формула (расширение DU): 1 DU = 1 CE.**

| Источник | Формула CE |
| --- | --- |
| Вражеский мех | `victim.maxHp × victim.level` (щит не считается; killer level не участвует — считается уровень убитого) |
| Босс | `boss.maxHp` (уже включает `hpMult`) |
| Монстр | `enemy.maxHp` (уже включает `hpMult`) |

Симметрично для обеих сторон: бот получает CE за убитый мех игрока по той же формуле, питает **внутримиссионный** левелинг мехов бота (`grantAiProgress`), в кошелёк бота НЕ идёт (кошелёк бота растёт только через `RIVAL.gainPerWin`, см. секцию **RIVAL**).

**Экономика:**
- Внутри миссии CE = `Game.missionCE` — общий пул ВСЕГО копья игрока: убийство засчитывается в `missionCE`, если убийца имеет `faction === 'player'` (управляемый мех ИЛИ любой AI-ведомый), не только текущий управляемый. Отдельно от этого — левелинг персонально по мехам: убивший мех получает XP на свой собственный уровень (управляемый - через выбор перка вручную, AI-ведомые - автовыбор через `grantAiProgress`).
- Между миссиями: часть `missionCE` конвертируется в персистентный `Game.ceWallet` (валюта Магазина) по исходу миссии (`BALANCE.CE`):

| Исход | Доля missionCE → wallet | Streak |
| --- | --- | --- |
| Игрок убил босса (win) | 100% (`CE.unit`, полный) | winStreak++, lossStreak=0 |
| Босс убит ботом (raceLoss, 0 CE за босса — killer не игрок) | `CE.raceLossShare` = 50% | lossStreak++, winStreak=0 |
| Вайп копья игрока (wipe) | `CE.wipeShare` = 50% (тот же штраф, что у любого другого проигрыша) | lossStreak++, winStreak=0 |

- Уровень меха обнуляется в начале каждой миссии (level 1); CE-баффы миссии не переносятся.
- Непотраченный `ceWallet` не сгорает — персистентен между миссиями, тратится на тактические апгрейды (секция 7) и косметику (`COSMETICS`, ноль влияния на баланс).
- SCORE полностью убран из UI и кода (`RunStats.ce`, `HighScores` ранжируют по CE).

---

## 7. TACTICAL UPGRADES (v8, `balance.js` → `TACTICAL_UPGRADES`)

Покупаются в Lance Hub на конкретный слот (класс) копья; переживают миссии, пока тип меха слота не меняется (смена типа = `lanceSlotUpgrades[slot]` очищается без возврата CE). `lance`-ветка общая — покупается один раз, действует на все 3 меха копья. `maxPerMech` = 4.

| Branch | Upgrade | Cost (CE) | Effect |
| --- | --- | --- | --- |
| Heavy | improvedHeavy | 50 | +3 maxHP / +2 maxShield |
| Heavy | bastionShield | 150 | shield radius ×2, союзники прячутся, урон идёт носителю щита |
| Heavy | seismicSlam | 130 | dash-end shockwave, 6 DU, r100 |
| Heavy | juggernautMk2 | 120 | dash damage 3→5 DU, fuel drain ×0.7 |
| Battle | improvedBattle | 50 | +2 maxHP / +1 maxShield |
| Battle | turretRocket | 140 | турель: 2× rpg barrels |
| Battle | turretLaser | 130 | турель: 2× laser barrels |
| Scout | improvedScout | 50 | +2 maxHP / +1 maxShield |
| Scout | permaFlight | 130 | инверсия джетпака (см. секцию 1) |
| Lance | formationTactics | 100 | тугой строй (см. секцию **LANCE**) |

**Streak-цены** (`STREAK`, показываются в Hub): серия побед — скидка `-5%/win`, кап `-25%`; серия поражений — наценка `+5%/loss`, кап `+25%`. Победа сбрасывает loss streak и наоборот, никогда не действуют одновременно.

---

## 8. RIVAL (v8)

- Персистентный `Game.rivalBudget`: `+= RIVAL.gainPerWin` (70 CE, ~40% среднего CE босса) **только** когда игрок выигрывает контракт (win). Поражение игрока не растит бюджет бота — death spiral исключён.
- Перед каждой миссией: рандомная композиция из 3 классов (`randomLanceComposition`), закупка через `purchaseRivalLoadout` — тот же каталог `TACTICAL_UPGRADES`, те же цены, взвешено по классу меха (напр. heavy тяготеет к Bastion Shield), кап на меха как у игрока, до исчерпания бюджета. Остаток бюджета переносится в следующую миссию.
- Видимость: Contract Briefing показывает лоадаут вражеского копья (класс + апгрейды на слот + общая тактика) до старта миссии.
- Флавор: `Game.rivalCompanyName` (имя наёмничьей компании, выбирается на старте рана) + `Game.rivalMechKills` (персистентный счётчик мехов игрока, убитых этой компанией).

---

## 9. МИССИЯ (контракт на босса, v8)

- Миссия = гонка двух копий за убийство босса текущего биома (mantis/fortress/eye — без изменений, редизайн боссов отложен до графической фазы).
- Rival AI охотится на босса, а не только на игрока (приоритет boss > мехи игрока > монстры, секция 3).
- Босс убит игроком → `resolveMissionEnd('win')` → Lance Hub (состав + магазин) для следующей миссии.
- Босс убит ботом → **не геймовер**: `resolveMissionEnd('raceLoss')`, игрок получает 50% missionCE, 0 за босса, тоже уходит в Lance Hub.
- Вайп копья игрока → `resolveMissionEnd('wipe')`: 50% missionCE за эту миссию (тот же штраф, что и у raceLoss), recap-экран с submit в `HighScores`, но кошелёк/streak'и/апгрейды **не сбрасываются** — `[RETURN TO LANCE HUB]` продолжает тот же прогон.
- Бот без мехов (вайпнут) — не респавнится, миссия продолжается волнами/боссом только для игрока.

---

## 10. Файлы канона

| Concern | Path |
| --- | --- |
| All numbers | `src/config/balance.js` |
| Bullets | `src/entities/Bullet.js` |
| Mech / shield regen / Juggernaut Dash / Perma-Flight | `src/entities/Player.js` |
| Enemy weapons / shields | `src/entities/Enemy.js` |
| dmg absorb / contact / mission lifecycle / CE / Bastion Shield routing | `src/game/Game.js` |
| Lance formation / rival target priority | `src/entities/BotController.js`, `src/entities/botTactics.js` |
| Tactical upgrade catalog application | `src/progression/tacticalUpgrades.js` |
| Rival budget shopping | `src/progression/rivalBudget.js` |
| Lance Hub / Contract Briefing / lance HUD strip | `src/ui/hub.js` |

---

## 11. Чеклист баланса

1. Числа — только в `balance.js`.
2. Оружие OP? → `WEAPONS.*`
3. Монстр танк? → `ENEMIES.*.hp` / `shield`
4. Исходящий? → тот же `WEAPONS` + AI interval (не отдельная таблица урона)
5. Новые числа Lance/CE/Upgrades/Rival/Streak — только в `balance.js` (секции `LANCE`, `CE`, `TACTICAL_UPGRADES`, `RIVAL`, `STREAK`, `HEAVY_ABILITIES`, `COSMETICS`).
6. После правки — сверить эту матрицу.

---

*One physics DU. При расхождении — верить `balance.js`.*
