import {Observable as O} from 'rx';
import I from 'immutable';

import {
  expressionFromJson,
  collectIdentifiers,
  collectSubExpressions,
  evaluateExpression,
} from '../lib/expression';

import cParser from '../lib/syntax/logic-c.pegjs';
import latexParser from '../lib/syntax/logic-latex.pegjs';
import mathParser from '../lib/syntax/logic-math.pegjs';
import pythonParser from '../lib/syntax/logic-python.pegjs';

function ParseError({lang, string, message, location, detected = null}) {
  this.lang = lang;
  this.string = string;
  this.message = message;
  this.location = location;
  this.detected = detected;
};

const language = I.Record({
  name: null,
  parse: () => { throw new Error("not implemented"); },
});

const cLang = language({
  name: 'C',
  parse: (string) => {
    return {
      lang: 'c',
      parsed: cParser.parse(string),
    };
  },
});

const latexLang = language({
  name: 'Latex',
  parse: (string) => {
    return {
      lang: 'latex',
      parsed: latexParser.parse(string),
    };
  },
});

const pythonLang = language({
  name: 'Python',
  parse: (string) => {
    return {
      lang: 'python',
      parsed: pythonParser.parse(string),
    };
  },
});

const mathLang = language({
  name: 'Math',
  parse: (string) => {
    return {
      lang: 'math',
      parsed: mathParser.parse(string),
    };
  },
});

const allLanguages = [
  cLang,
  pythonLang,
  latexLang,
  mathLang,
];

const autoLang = language({
  name: 'Auto detect',
  parse: (string) => {
    let error = null;
    let detected = null;
    for (const lang of allLanguages) {
      try {
        const result = lang.parse(string);
        return {
          parsed: result.parsed,
          lang: 'auto',
          detected: lang.name,
        };
      } catch (e) {
        if (!error) {
          detected = lang.name;
          error = e;
        } else if (
          e.location.start.offset >
          error.location.start.offset
        ) {
          detected = lang.name;
          error = e;
        }
      }
    }

    throw new ParseError({
      lang: 'auto',
      string,
      message: error.message,
      location: error.location,
      detected,
    });
  },
});

const languages = {
  auto: autoLang,
  c: cLang,
  latex: latexLang,
  math: mathLang,
  python: pythonLang,
};

const parse = ({string, lang, showSubExpressions}) => {
  try {
    const parseResult = languages[lang]
      .parse(string);

    return {
      lang: parseResult.lang,
      detected: parseResult.detected,
      string,
      showSubExpressions,
      expressions: parseResult.parsed.map(expressionFromJson),
    };
  } catch (e) {
    throw new ParseError({
      lang, string,
      message: e.message,
      location: e.location,
      detected: e.detected,
    });
  }
};

const analyze = ({lang, detected, expressions, string, showSubExpressions}) => {
  const expressionList = I.List(expressions);

  const identifiers = expressionList.flatMap(
    (expression) => collectIdentifiers(expression)
  ).toSet().toList();

  const subExpressions = expressionList.flatMap(
    (expression) => collectSubExpressions(expression)
      .toList()
  );

  const toplevelExpressions = expressionList.filter(
    (e) => e.node !== 'identifier' && e.node !== 'constant'
  );

  return {
    lang,
    detected,
    string,
    expressions: expressionList,
    identifiers,
    subExpressions,
    toplevelExpressions,
    showSubExpressions,
  };
};

const handleError = (error) =>
  O.just({
    lang: error.lang,
    detected: error.detected,
    error: {
      location: error.location,
      message: error.message,
    },
    string: error.string,
  })
;

export default (actions) => {
  const parsed$ = O.combineLatest(
    actions.input$.startWith(''),
    actions.language$.startWith('auto'),
    actions.showSubExpressions$.startWith(true),
    (string, lang, showSubExpressions) =>
      O.just({
        string,
        lang,
        detected: null,
        showSubExpressions,
      })
      .map(parse)
      .map(analyze)
      .catch(handleError)
      .flatMap(({
        detected,
        expressions,
        identifiers,
        subExpressions,
        error,
        toplevelExpressions,
      }) => actions.selectRow$
        .startWith(null)
        .scan((prev, val) => prev === val ? null : val)
        .map(
        (selectedRow) => {
          let subEvalutation = null;

          /*eslint-disable max-nested-callbacks*/
          if (selectedRow !== null) {
            const identifierMap = I.Map(identifiers.map(
              (name, i) => [name, !!(Math.pow(2, i) & selectedRow)]
            ));

            subEvalutation = I.Map(toplevelExpressions.map((expr) =>
              [expr, evaluateExpression(expr, identifierMap)]
            )).merge(identifierMap);
          }
          /*eslint-enable max-nested-callbacks*/

          return {
            lang,
            detected,
            string,
            expressions,
            identifiers,
            subExpressions,
            showSubExpressions,
            error,
            selectedRow,
            subEvalutation,
            toplevelExpressions,
            table: I.List(),
          };
        }
      ))
  ).switch();

  return parsed$.share();
}
;
