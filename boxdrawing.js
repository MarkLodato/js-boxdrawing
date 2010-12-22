/* Add box drawing capability to textareas.
 * Copyright (c) 2010 Mark Lodato <lodatom@gmail.com>
 * Released under the Expat (aka MIT) license.
 *
 * getCaret() and setCaret() based on jQuery Caret Range plugin
 * Copyright (c) 2009 Matt Zabriskie
 *
 * TODO characters to implement:
 *    - fills
 *    - diagonals
 *    - dashes
 *    - ASCII characters
 *    - arrows / triangles
 *
 * TODO features:
 *    - move blocks of characters
 *
 * TODO things to check:
 *    - do \r's mess us up?
 *    - test on browsers other than FF 3.6
 *
 * TODO things to improve:
 *    - better handling of double vs regular
 *        - in particular, fall back to regular if doulbe is not available
 *
 *        0123456789abcdef | │╎┆┊╵╷╽ ─ ╴╶ ╼ ╌ ┄ ┈ | Common elements:
 * U+250x ─━│┃┄┅┆┇┈┉┊┋┌┍┎┏ | ┃╏┇┋╹╻╿ ━ ╸╺ ╾ ╍ ┅ ┉ |
 * U+251x ┐┑┒┓└┕┖┗┘┙┚┛├┝┞┟ | ┌┍┎┏ ┐┑┒┓ ├┤┝┥ ┼╋┿╂  | ┌┬┐┏┳┓╔╦╗┍┯┑╒╤╕┎┰┒╓╥╖
 * U+252x ┠┡┢┣┤┥┦┧┨┩┪┫┬┭┮┯ | └┕┖┗ ┘┙┚┛ ┟┧┢┪ ┽╀┾╁  | ├┼┤┣╋┫╠╬╣┝┿┥╞╪╡┠╂┨╟╫╢
 * U+253x ┰┱┲┳┴┵┶┷┸┹┺┻┼┽┾┿ | ┬┮┯┭ ┰┲┳┱ ┠┨┣┫ ╊╈╉╇  | └┴┘┗┻┛╚╩╝┕┷┙╘╧╛┖┸┚╙╨╜
 * U+254x ╀╁╂╃╄╅╆╇╈╉╊╋╌╍╎╏ | ┴┶┷┵ ┸┺┻┹ ┞┦┡┩ ╃╄╆╅  | ─│ ━┃ ═║
 * U+255x ═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟ | ╔╦╗╒╤╕╓╥╖            |
 * U+256x ╠╡╢╣╤╥╦╧╨╩╪╫╬╭╮╯ | ╠╬╣╞╪╡╟╫╢ ═ ║ ╱╳╲ ╭╮ |
 * U+257x ╰╱╲╳╴╵╶╷╸╹╺╻╼╽╾╿ | ╚╩╝╘╧╛╙╨╜         ╰╯ |
 */

// A default handler.  It is probably better to have some forms that the user
// can click on to select the weight and to possibly change the characters
// that cause the drawing.
//
// Usage:
//    - CTRL + ARROW KEY to draw a solid line
//    - CTRL + SHIFT + ARROW KEY to draw bold line
//    - CTRL + ALT + ARROW KEY to draw a double line
//    - CTRL + ALT + SHIFT + ARROW KEY to erase a line
DrawBoxHandler = function (evt)
{
  if (!evt.ctrlKey || evt.keyCode < 37 || evt.keyCode > 40)
    return;

  var direction = evt.keyCode - 37;

  var style = 'r';
  if (evt.shiftKey && evt.altKey) {
    style = '_';
  } else if (evt.shiftKey) {
    style = 'b';
  } else if (evt.altKey) {
    style = 'd';
  }

  DrawBox(evt.target, style, direction);

  // don't propagate this event
  return false;
};

DrawBox = function (elem, style, direction)
{
  var text = elem.value;
  var caret = DrawBox.getCaret(elem);

  // bail if newline is selected or if more than one character is selected
  if (caret.start < caret.end - 1 ||
      (caret.start == caret.end - 1 && text[caret.start] == '\n'))
    return;

  // break text into lines and compute the current row and column
  var lines = text.split('\n');
  var row = (text.substr(0, caret.start).match(/\n/g) || []).length;
  var col = caret.start - text.lastIndexOf("\n", caret.start) - 1;
  if (col < 0) {
    col = lines[row].length;
  }

  var row2 = row, col2 = col;
  switch (direction) {
    case DrawBox.LEFT:
      if (col == 0)
        return;
      col2--;
      break;
    case DrawBox.RIGHT:
      if (caret.start != caret.end)
        col2++;
      break;
    case DrawBox.UP:
      if (row == 0)
        return;
      row2--;
      if (caret.start == caret.end && col >= lines[row].length)
        col2--;
      break;
    case DrawBox.DOWN:
      row2++;
      if (caret.start == caret.end && col >= lines[row].length)
        col2--;
      break;
  }

  // If there exists a symbol with an outward line, use it in the current
  // position.
  if (caret.start != caret.end) {
    var character = DrawBox.get(lines, row, col);
    if (typeof character != "undefined") {
      var prop = DrawBox.symbols[character];
      if (prop) {
        if (prop == 'd_d_' || prop == '_d_d' || prop == 'dddd') {
          // special case: double lines do not have half-lines, so we have to
          // turn full lines into corners if the other end is a space.
          var a = ['_','_','_','_'], s;
          if (direction == DrawBox.LEFT) {
            a[0] = style;
          } else if (prop[DrawBox.LEFT] == "d") {
              s = DrawBox.symbols[ DrawBox.get(lines, row, col-1) ] || '____';
              a[0] = s[DrawBox.RIGHT];
          }
          if (direction == DrawBox.UP) {
            a[1] = style;
          } else if (prop[DrawBox.UP] == "d") {
              s = DrawBox.symbols[ DrawBox.get(lines, row-1, col) ] || '____';
              a[1] = s[DrawBox.DOWN];
          }
          if (direction == DrawBox.RIGHT) {
            a[2] = style;
          } else if (prop[DrawBox.RIGHT] == "d") {
              s = DrawBox.symbols[ DrawBox.get(lines, row, col+1) ] || '____';
              a[2] = s[DrawBox.LEFT];
          }
          if (direction == DrawBox.DOWN) {
            a[3] = style;
          } else if (prop[DrawBox.DOWN] == "d") {
              s = DrawBox.symbols[ DrawBox.get(lines, row+1, col) ] || '____';
              a[3] = s[DrawBox.UP];
          }
          prop_r = a.join('');
          // We have to replace bold with regular.
          prop_r = prop_r.replace(/[^dr_]/g, 'r');
        } else {
          var prop_r = prop.substr(0,direction)
            + style + prop.substr(direction+1);
        }
        var new_character = DrawBox.reverse[prop_r];
        if (typeof new_character != "undefined") {
          DrawBox.set(lines, row, col, new_character);
        }
      }
    }
  }

  // Draw the new character.
  var character2 = DrawBox.get(lines, row2, col2, ' ');
  if (typeof character2 != "undefined") {

    // Find and use the most appropriate symbol for the next position.
    var prop2 = DrawBox.symbols[character2];
    var dir2 = direction ^ DrawBox.REVERSE;
    var new_character2, prop2_r;
    if (prop2) {
      prop2_r = prop2.substr(0,dir2) + style + prop2.substr(dir2+1);
      new_character2 = DrawBox.reverse[prop2_r];
    }
    if (typeof new_character2 == "undefined") {
      // No perfect fit, so try a half-line.
      prop2 = "____";
      prop2_r = prop2.substr(0,dir2) + style + prop2.substr(dir2+1);
      new_character2 = DrawBox.reverse[prop2_r];
    }
    if (typeof new_character2 == "undefined") {
      // No half-line.  Look to the neighbors to see what we should do.
      var l = DrawBox.symbols[ DrawBox.get(lines, row2  , col2-1) ];
      var u = DrawBox.symbols[ DrawBox.get(lines, row2-1, col2  ) ];
      var r = DrawBox.symbols[ DrawBox.get(lines, row2  , col2+1) ];
      var d = DrawBox.symbols[ DrawBox.get(lines, row2+1, col2  ) ];
      prop2_r = [
        dir2 == DrawBox.LEFT  ? style : l ? l[DrawBox.RIGHT] : '_',
        dir2 == DrawBox.UP    ? style : u ? u[DrawBox.DOWN ] : '_',
        dir2 == DrawBox.RIGHT ? style : r ? r[DrawBox.LEFT ] : '_',
        dir2 == DrawBox.DOWN  ? style : d ? d[DrawBox.UP   ] : '_',
        ].join('');
      new_character2 = DrawBox.reverse[prop2_r];
    }
    if (typeof new_character2 == "undefined") {
      // Nope.  What if we replace all the other styles with regular?
      prop2_r = prop2_r.replace(new RegExp('[^'+style+'_]', 'g'), 'r');
      new_character2 = DrawBox.reverse[prop2_r];
    }
    if (typeof new_character2 == "undefined") {
      // Ok, fall back to a straight line.
      if (dir2 == DrawBox.LEFT || dir2 == DrawBox.RIGHT)
        prop2_r = style + "_" + style + "_";
      else
        prop2_r = "_" + style + "_" + style;
      new_character2 = DrawBox.reverse[prop2_r];
    }
    if (typeof new_character2 == "undefined") {
      // Something went totally wrong.
      new_character2 = "?";
    }
    DrawBox.set(lines, row2, col2, new_character2);

    // Write the new value back.
    text = lines.join("\n");
    elem.value = text;

    // highlight the new character
    var start = 0;
    var end;
    for (var i = 0; i < row2; i++) {
      start += lines[i].length + 1;
    }
    start += col2;
    end = start;
    if (col2 < lines[row2].length) {
      end++;
    }
    DrawBox.setCaret(elem, start, end);
  }
};


DrawBox.symbols = {
  //  'LURD'      _=blank r=regular b=bold d=double
  ' ':'____',
  '╴':'r___', '╸':'b___',
  '╵':'_r__', '╹':'_b__',
  '╶':'__r_', '╺':'__b_',
  '╷':'___r', '╻':'___b',
  '┘':'rr__', '┛':'bb__', '┙':'br__', '┚':'rb__',
  '─':'r_r_', '━':'b_b_', '╾':'b_r_', '╼':'r_b_',
  '┐':'r__r', '┓':'b__b', '┑':'b__r', '┒':'r__b',
  '└':'_rr_', '┗':'_bb_', '┖':'_br_', '┕':'_rb_',
  '│':'_r_r', '┃':'_b_b', '╿':'_b_r', '╽':'_r_b',
  '┌':'__rr', '┏':'__bb', '┍':'__br', '┎':'__rb',
  '┴':'rrr_', '┻':'bbb_', '┵':'brr_', '┸':'rbr_', '┶':'rrb_',
  '┺':'rbb_', '┷':'brb_', '┹':'bbr_',
  '┤':'rr_r', '┫':'bb_b', '┥':'br_r', '┦':'rb_r', '┧':'rr_b',
  '┨':'rb_b', '┪':'br_b', '┩':'bb_r',
  '┬':'r_rr', '┳':'b_bb', '┭':'b_rr', '┮':'r_br', '┰':'r_rb',
  '┲':'r_bb', '┱':'b_rb', '┯':'b_br',
  '├':'_rrr', '┣':'_bbb', '┞':'_brr', '┝':'_rbr', '┟':'_rrb',
  '┢':'_rbb', '┠':'_brb', '┡':'_bbr',
  '┼':'rrrr', '╋':'bbbb', '┽':'brrr', '╀':'rbrr', '┾':'rrbr', '╁':'rrrb',
  '╊':'rbbb', '╈':'brbb', '╉':'bbrb', '╇':'bbbr',
  '╂':'rbrb', '┿':'brbr', '╃':'bbrr', '╄':'rbbr', '╆':'rrbb', '╅':'brrb',
  '═':'d_d_', '║':'_d_d',
  '╝':'dd__', '╚':'_dd_', '╔':'__dd', '╗':'d__d',
  '╜':'rd__', '╘':'_rd_', '╓':'__rd', '╕':'d__r',
  '╛':'dr__', '╙':'_dr_', '╒':'__dr', '╖':'r__d',
  '╩':'ddd_', '╠':'_ddd', '╦':'d_dd', '╣':'dd_d',
  '╨':'rdr_', '╞':'_rdr', '╥':'r_rd', '╡':'dr_r',
  '╧':'drd_', '╟':'_drd', '╤':'d_dr', '╢':'rd_d',
  '╬':'dddd', '╪':'drdr', '╫':'rdrd'
};


DrawBox.reverse = (function(symbols)
  {
    var reverse = {};
    for (var name in symbols) {
      if (symbols.hasOwnProperty(name)) {
        reverse[ symbols[name] ] = name;
      }
    }
    return reverse;
  })(DrawBox.symbols);


DrawBox.get = function(lines, r, c, default_value)
{
  if (r < 0 || c < 0)
    return;
  if (r >= lines.length)
    return default_value;
  var l = lines[r];
  if (c >= l.length)
    return default_value;
  return l[c];
};


DrawBox.set = function(lines, r, c, v)
{
  if (r < 0 || c < 0)
    return;
  while (r >= lines.length)
    lines.push('');
  var l = lines[r];
  if (c > l.length)
    l += Array(c - l.length + 1).join(' ');
  l = l.substring(0,c) + v + l.substring(c+1);
  lines[r] = l;
  return v;
};


DrawBox.getCaret = function(elem)
{
  if ('selectionStart' in elem) {
    return {start:elem.selectionStart, end:elem.selectionEnd};
  }
  else if ('selection' in document) {
    var val = elem.value.replace(/\r\n/g, "\n");

    var range = document.selection.createRange().duplicate();
    range.moveEnd("character", val.length);
    var start = (range.text == "" ? val.length : val.lastIndexOf(range.text));

    range = document.selection.createRange().duplicate();
    range.moveStart("character", -val.length);
    var end = range.text.length;
    return {start:start, end:end};
  }
  else {
    return {start:undefined, end:undefined};
  }
};


DrawBox.setCaret = function(elem, start, end)
{
  var val = elem.value;

  if (start < 0) start = 0;
  if (typeof end == "undefined") end = start;
  if (end > val.length) end = val.length;
  if (end < start) end = start;
  if (start > end) start = end;

  elem.focus();

  if ('selectionStart' in elem) {
    elem.selectionStart = start;
    elem.selectionEnd = end;
  }
  else if ('selection' in document) {
    val = val.replace(/\r\n/g, "\n");
    var range = elem.createTextRange();
    range.collapse(true);
    range.moveStart("character", start);
    range.moveEnd("character", end - start);
    range.select();
  }
  else {
    start = undefined;
    end = undefined;
  }

  return {start:start, end:end};
};


// Directions
DrawBox.LEFT = 0;
DrawBox.UP = 1;
DrawBox.RIGHT = 2;
DrawBox.DOWN = 3;

// XOR with this value to reverse a direction
DrawBox.REVERSE = 2;
