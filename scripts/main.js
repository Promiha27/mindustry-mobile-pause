// Mobile HUD Extras — рабочая кнопка паузы на мобильной версии.
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

Events.on(ClientLoadEvent, () => {
    let table = new Table();
    table.setFillParent(true);
    table.top().right();
    table.defaults().size(BUTTON_SIZE).pad(2);

    table.button(Icon.pause, Styles.clearNonei, () => {
        if (Vars.net.client()) return; // как на десктопе - обычный клиент паузу не ставит
        if (Vars.state.rules.pauseDisabled) {
            Vars.ui.hudfrag.showPauseDisabled();
        } else {
            Vars.state.set(Vars.state.isPaused() ? MheStatePlaying : MheStatePaused);
        }
    }).name("mhe-pause")
      .visible(() => Vars.mobile && Vars.state.isGame() && !Vars.net.client())
      .update(i => {
          i.setDisabled(Vars.state.rules.pauseDisabled || (Vars.state.isCampaign() && Vars.state.afterGameOver));
          i.getStyle().imageUp = Vars.state.isPaused() ? Icon.play : Icon.pause;
      });

    Core.app.post(() => Vars.ui.hudGroup.addChild(table));
});
