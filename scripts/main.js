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
// Позиция кнопки настраивается двумя слайдерами в настройках мода (доля
// от ширины/высоты экрана, а не пиксели - чтобы не съезжать при смене
// разрешения/поворота экрана).

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
    let table = new Table();
    table.setSize(BUTTON_SIZE, BUTTON_SIZE);
    table.defaults().size(BUTTON_SIZE);

    table.button(Icon.pause, Styles.clearNonei, () => {
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

          // позиция - доля от ширины/высоты экрана, настраивается слайдерами
          // в настройках мода; пересчитываем в пиксели каждый кадр, чтобы
          // не съезжать при смене разрешения/поворота экрана.
          let w = Core.graphics.getWidth(), h = Core.graphics.getHeight();
          let fracX = Core.settings.getInt("mhe-pause-x", 93) / 100;
          let fracY = Core.settings.getInt("mhe-pause-y", 88) / 100;
          table.setPosition(
              mheClamp(fracX * w - BUTTON_SIZE / 2, 0, w - BUTTON_SIZE),
              mheClamp(fracY * h - BUTTON_SIZE / 2, 0, h - BUTTON_SIZE)
          );
      })
      // важно: видимость переключаем через Cell.visible(Boolp), а не через
      // table.visible(fn) - у Element (и, значит, у Table) "visible" это
      // одновременно и boolean-поле, и метод, и Rhino резолвит property
      // access в поле, так что table.visible(fn) падает с "not a function,
      // it is boolean". А если вместо этого просто присвоить полю
      // table.visible = false, то сам table перестаёт рисоваться - а вместе
      // с ним и update() выше, который единственный мог вернуть его в true
      // (эта версия крашила игру на старте, следующая - просто прятала
      // кнопку навсегда). У Cell такой коллизии нет - там только метод.
      .visible(() => Vars.mobile && Vars.state.isGame() && !Vars.net.client());

    Core.app.post(() => Vars.ui.hudGroup.addChild(table));
});

// Раздел настроек мода (слайдеры X/Y позиции) в общем меню настроек игры.
//
// ВАЖНО (тот же грабли уже задокументированы в CustomUnitPortraits/scripts/
// settings-ui.js и ExtendedUIPlus/scripts/ui/other/settings-ui.js на этом же
// клиенте): объект `t`, который приходит в колбэк
// Vars.ui.settings.addCategory(...), - это НАСТОЯЩАЯ SettingsMenuDialog.
// SettingsTable из игрового экрана настроек со строкой поиска. Любой "сырой"
// виджет (t.row()/t.button()/t.add()), не добавленный через t.pref(...),
// НАВСЕГДА отключает поиск по настройкам во всём экране (не только в этой
// категории). Поэтому в саму категорию добавляется РОВНО один pref() -
// кнопка открытия своего диалога; слайдеры живут в отдельном BaseDialog со
// своим обычным SettingsTable, куда это ограничение не относится.
Events.on(ClientLoadEvent, () => {
    const settingsDialog = new BaseDialog("Mobile Pause");
    settingsDialog.addCloseButton();

    settingsDialog.cont.pane((() => {
        const contentTable = new SettingsMenuDialog.SettingsTable();
        contentTable.sliderPref("mhe-pause-x", 93, 0, 100, 1, i => i + "%");
        contentTable.sliderPref("mhe-pause-y", 88, 0, 100, 1, i => i + "%");
        return contentTable;
    })());

    try {
        const openButtonSetting = extend(SettingsMenuDialog.SettingsTable.Setting, "mhe-open-settings", {
            add: table => {
                table.button("Mobile Pause", Styles.defaultt, () => settingsDialog.show()).width(240).height(50);
                table.row();
            }
        });
        // title участвует в поиске по настройкам; конструктор Setting сам бы
        // взял его из несуществующего bundle-ключа setting.mhe-open-settings.name.
        openButtonSetting.title = "Mobile Pause";
        Vars.ui.settings.addCategory("Mobile Pause", t => t.pref(openButtonSetting));
    } catch (e) {
        // Фолбэк на сырой способ: варнинг в логе вернётся, но кнопка гарантированно будет.
        Log.err("[MobilePause] settings: custom Setting failed, falling back to raw button: " + e);
        Vars.ui.settings.addCategory("Mobile Pause", t => {
            t.row();
            t.button("Mobile Pause", Styles.defaultt, () => settingsDialog.show()).width(240).height(50);
        });
    }
});
