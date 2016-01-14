/* lexical grammar */
%lex
%%
\s+                       {/* skip whitespace */}
"true"                       {return 'TRUE';}
"false"                       {return 'FALSE';}
"and"                       {return 'AND';}
"or"                       {return 'OR';}
"xor"                       {return 'XOR';}
"not"                       {return 'NOT';}
[A-Za-z][_A-Za-z0-9]*\b   {return 'IDENTIFIER';}
"("                       {return '(';}
")"                       {return ')';}
","                       {return ',';}
<<EOF>>                   {return 'EOF';}

/lex

/* operator associations and precedence */

%left 'AND'
%left 'OR'
%left 'XOR'
%left 'NOT'

%start expressions

%% /* language grammar */

expressions
    : expressionList EOF
        {return $1;}
    | EOF
        {return [];}
    ;

expressionList
    : e
        {$$ = [$1];}
    | expressionList ',' e
        {$$ = $1; $1.push($3);}
    ;

e
    : e 'AND' e
        {$$ = {node: 'binary', operator: 'AND', lhs: $1, rhs: $3};}
    | e 'OR' e
        {$$ = {node: 'binary', operator: 'OR', lhs: $1, rhs: $3};}
    | e 'XOR' e
        {$$ = {node: 'binary', operator: 'XOR', lhs: $1, rhs: $3};}
    | 'NOT' e
        {$$ = {node: 'unary', operator: 'NOT', operand: $2};}
    | '(' e ')'
        {$$ = {node: 'group', style: 1, content: $2};}
    | IDENTIFIER
        {$$ = {node: 'identifier', name: yytext};}
    | TRUE
        {$$ = {node: 'constant', value: true};}
    | FALSE
        {$$ = {node: 'constant', value: false};}
    ;
