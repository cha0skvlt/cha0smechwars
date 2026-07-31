function validateFuelState(entity) {
    if(!entity || !Number.isFinite(entity.fuel) || !Number.isFinite(entity.maxFuel)) {
        throw new TypeError('Fuel state requires finite fuel and maxFuel values');
    }
}

export function consumeFuel(entity, cost) {
    validateFuelState(entity);
    if(!Number.isFinite(cost) || cost < 0) throw new TypeError('Fuel cost must be non-negative');
    if(entity.fuel < cost) return false;
    entity.fuel -= cost;
    return true;
}

export function regenerateFuel(entity, rate) {
    validateFuelState(entity);
    if(!Number.isFinite(rate) || rate < 0) throw new TypeError('Fuel regeneration must be non-negative');
    entity.fuel = Math.min(entity.maxFuel, entity.fuel + rate);
    return entity.fuel;
}
