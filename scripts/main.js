// Mobile Pause — рабочая кнопка паузы на мобильной версии.
//
// В движке этого клиента (core/src/mindustry/ui/fragments/HudFragment.java,
// мобильный ряд кнопок "select") пауза зашита так: если net.active()
// (в т.ч. когда САМ хостишь!) - кнопка превращается в переключатель списка
// игроков, а не паузу. На десктопе (Control.java) хоста отличают от клиента
// точнее - !net.client(), а не !net.active() - поэтому там хост паузу
// ставит нормально, а на мобиле не может вообще, пока сам хостит.
//
// Патчить вшитую кнопку из JS-мода нельзя (это Java-код форка), поэтому мод
// добавляет свою кнопку паузы поверх HUD с той же логикой, что и на
// десктопе (!net.client()) - работает и в одиночной игре, и при хостинге,
// пропадает только для обычного подключённого клиента (как и на ПК).
//
// Кнопку можно перетащить пальцем в любое место экрана - позиция хранится
// в Core.settings как доля от ширины/высоты экрана (а не в пикселях), чтобы
// не съезжать при смене разрешения/поворота экрана.

if (global.mhe && global.mhe._loaded) {
    return;
}
if (!global.mhe) {
    global.mhe = {};
}
global.mhe._loaded = true;

// GameState.State - вложенный enum; importClass на него валит весь файл
// ("Cannot import GameState$State since a property by that name is already
// defined") - тот же грабли, что уже задокументированы в SectorStatsMod.
// Обходится fully-qualified доступом без импорта.
var MheStatePaused = Packages.mindustry.core.GameState.State.paused;
var MheStatePlaying = Packages.mindustry.core.GameState.State.playing;

const BUTTON_SIZE = 64;

function mheClamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

Events.on(ClientLoadEvent, () => {
    // Доля от ширины/высоты экрана - по умолчанию верхний правый угол,
    // как у старого статично расположенного варианта кнопки.
    let fracX = Core.settings.getFloat("mhe-pause-fx", 0.93);
    let fracY = Core.settings.getFloat("mhe-pause-fy", 0.88);

    let dragging = false;
    let wasDragged = false;
    let startTableX = 0, startTableY = 0, startLocalX = 0, startLocalY = 0;

    let table = new Table();
    table.setSize(BUTTON_SIZE, BUTTON_SIZE);
    table.defaults().size(BUTTON_SIZE);

    let cell = table.button(Icon.pause, Styles.clearNonei, () => {
        if (wasDragged) {
            // это был перетаск, а не тап - паузу не переключаем
            wasDragged = false;
            return;
        }
        if (Vars.net.client()) return; // как на десктопе - обычный клиент паузу не ставит
        if (Vars.state.rules.pauseDisabled) {
            Vars.ui.hudfrag.showPauseDisabled();
        } else {
            Vars.state.set(Vars.state.isPaused() ? MheStatePlaying : MheStatePaused);
        }
    }).name("mhe-pause").size(BUTTON_SIZE)
      .update(i => {
          i.setDisabled(Vars.state.rules.pauseDisabled || (Vars.state.isCampaign() && Vars.state.afterGameOver));
          i.getStyle().imageUp = Vars.state.isPaused() ? Icon.play : Icon.pause;

          // синхронизируем пиксельную позицию с сохранённой долей экрана
          // каждый кадр (кроме как во время самого перетаскивания) - так
          // положение остаётся верным и после смены разрешения/поворота.
          if (!dragging) {
              let w = Core.graphics.getWidth(), h = Core.graphics.getHeight();
              table.setPosition(
                  mheClamp(fracX * w - BUTTON_SIZE / 2, 0, w - BUTTON_SIZE),
                  mheClamp(fracY * h - BUTTON_SIZE / 2, 0, h - BUTTON_SIZE)
              );
          }
      });

    table.visible(() => Vars.mobile && Vars.state.isGame() && !Vars.net.client());

    let button = cell.get();
    button.addListener(extend(DragListener, {
        dragStart(event, x, y, pointer) {
            dragging = true;
            startTableX = table.x;
            startTableY = table.y;
            startLocalX = x;
            startLocalY = y;
        },
        drag(event, x, y, pointer) {
            wasDragged = true;
            let w = Core.graphics.getWidth(), h = Core.graphics.getHeight();
            table.setPosition(
                mheClamp(startTableX + (x - startLocalX), 0, w - BUTTON_SIZE),
                mheClamp(startTableY + (y - startLocalY), 0, h - BUTTON_SIZE)
            );
        },
        dragStop(event, x, y, pointer) {
            dragging = false;
            let w = Core.graphics.getWidth(), h = Core.graphics.getHeight();
            fracX = (table.x + BUTTON_SIZE / 2) / w;
            fracY = (table.y + BUTTON_SIZE / 2) / h;
            Core.settings.put("mhe-pause-fx", fracX);
            Core.settings.put("mhe-pause-fy", fracY);
            wasDragged = false;
        }
    }));

    Core.app.post(() => Vars.ui.hudGroup.addChild(table));
});
