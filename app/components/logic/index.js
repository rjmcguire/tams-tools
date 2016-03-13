import {Observable as O, Subject} from 'rx';
import isolate from '@cycle/isolate';

import Field from './input-field';

import model from './model';
import view from './view';
import intent from './intent';
import TableComponent from '../table';
import asciiTable from '../table/lib/format-ascii';

import modalPanels from './panels';

export default (responses) => {
  const {
    DOM,
    keydown,
  } = responses;

  const openData$ = new Subject();
  const selectedRow$ = new Subject();

  const actions = intent({
    DOM,
    openData$,
  });

  const field = isolate(Field)({DOM, input$: actions.openData$});

  const state$ = model(
    actions, field.output$,
    selectedRow$
  ).shareReplay(1);

  const tree$ = state$
    .map((s) => s.tree)
    .share();

  const table$ = state$
    .distinctUntilChanged((s) => s.table)
    .map((state) => state.table)
    .share();

  const formula$ = state$
    .map((s) => s.formula)
    .share();

  const tableComponent = isolate(TableComponent)({
    DOM,
    table$,
  });

  const panels = modalPanels({
    DOM, keydown, open$: actions.panel$,
    asciiTable$: table$.map(asciiTable),
    formula$,
  });

  const vtree$ = view(
    state$, field.DOM, tableComponent.DOM,
    O.combineLatest(
      Object.values(panels).map((p) => p.DOM)
    )
  );

  tableComponent.selectedRow$.subscribe(selectedRow$);
  panels.open.data$.subscribe(openData$);

  return {
    DOM: vtree$,
    preventDefault: O.merge([
      actions.preventDefault,
      field.preventDefault,
    ]),
    autoResize: field.autoResize,
    selectAll: panels.save.selectAll,
    tree$: tree$,
    insertString: field.insertString,
  };
};
