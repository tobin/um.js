my_div = document.getElementById("hello_area");
cycle_counter_div = document.getElementById("cycle_counter");

var is_new_line = 1;

var keybuffer = new Array();

function keypress(event) {
    // see https://developer.mozilla.org/en/DOM/event
    var i = event.charCode;
    if (i==13)  i = 10; // translate CR to LF
    keybuffer.push(i);
}
document.onkeypress = keypress;

function putchar(c) {
    var s = "";

    if (is_new_line) {
	var clock = new Date()
	s = "<tt><font color='blue'>["+clock.getHours() + ":" +
            clock.getMinutes() + ":" + clock.getSeconds() + "] </font></tt> ";
	is_new_line = 0;
    }    

    switch (c) {
    case 10: 
	s += "<br/>";
	is_new_line = 1;
	break;
    default:
	s += String.fromCharCode(c);
    }    
    my_div.innerHTML += s;
}

function writeln(str) {
    my_div.innerHTML += str + "<br/>";
}

function makeMachine() {
    var localVariable = 123;
    var registers = new Uint32Array(8);
    var arrays = new Array();  // An array of Uint32Arrays
    var pc;                    // program counter, aka finger
    var self;
    var cycle = 0;

    function byteswap(x) {
	return (x >>> 24) +
	    ((x & 0x00ff0000) >>>  8) +
	    ((x & 0x0000ff00) <<  8) +
	    ((x & 0x000000ff) * 0x01000000); // ugh!
    }

    // superstitiously move these out of the main execution loop so that they 
    // are not being allocated on every cycle.
    var instruction = 0;
    var A = 0;
    var B = 0;
    var C = 0;
    var opcode = 0;
    
    return {
	load: function(program) {
	    arrays[0] = program;
	    pc = 0;
	},

	set_self: function(x) {
	    self = x;
	},

        execute: function() {
	    cycle_counter_div.innerHTML = "[ " + cycle + " cycles ]";
	    for (var iterations=100000; iterations>0; iterations--) {

		/* Fetch */
		instruction = byteswap(arrays[0][pc]);
		
		/* Decode the instruction */    
 		opcode = instruction >>> 28;
		C =  instruction        & 7;
		B = (instruction >>> 3) & 7; 
		A = (instruction >>> 6) & 7;
		
		/* increment the program counter */
		pc ++;
		
		switch (opcode) {
		    
		case 0: /* Conditional Move */
		    if (registers[C])
			registers[A] = registers[B];
		    break;
		    
		case 1: /* Array Index */
		    registers[A] = byteswap(arrays[registers[B]][registers[C]]);
		    break;
		    
		case 2: /* Array Amendment */		
		    arrays[registers[A]][registers[B]]=byteswap(registers[C]);
		    break;
		    
		case 3: /* Addition */
		    registers[A] = registers[B] + registers[C];
		    break;
		    
		case 4: /* Multiplication */
		    registers[A] = registers[B] * registers[C];
		    break;
		    
		case 5: /* Division */
		    registers[A] = registers[B] / registers[C];
		    break;
		    
		case 6: /* NAND */
		    registers[A] = ~(registers[B] & registers[C]);
		    break;
		    
		    /* Oher Operators */
		    
		case 7:  /* Halt */
		    writeln("Machine stopped.");
		    return;
		    
		case 8:  /* Allocation */
		    var new_array_buf = new Uint32Array(registers[C]);
		    var new_array_num = arrays.indexOf(null);
		    if (new_array_num == -1) {
			new_array_num = arrays.length;
		    }
		    arrays[new_array_num] = new_array_buf;
		    registers[B] = new_array_num;
		    break;
		    
		case 9: /* Abandonment */
		    arrays[registers[C]] = null;
		    break;
		    
		case 10: /* Output */
		    putchar(registers[C]);
		    break;
		    
		case 11: /* Input */
		    /* if there is a keypress in the buffer, use it.  otherwise, back up
		       the program counter by one then stop and wait for a callback. */
		    if (keybuffer.length > 0) {
			registers[C] = keybuffer.shift();
			// do we want local echo? I'm not sure.
			putchar(registers[C]);
		    } else {
			pc = pc - 1;
			setTimeout(self.execute, 50); // FIXME
			return; //FIXME
		    }
		    break;
		    
		case 12: /* Load Program. */		
		    if (registers[B] != 0) {
			arrays[0] =  new Uint32Array(arrays[registers[B]]);
		    }
		    pc = registers[C];	
		    break;
		    
		    /* Special Operators. */
		case 13:
		    A = (instruction >> 25) & 7;
		    registers[A] = instruction & 0x1FFFFFF;
		    break;
		    
		default:  /* Unknown instruction */
		    writeln("Unknown opcode " + opcode + " in instruction " + instruction + " at pc = " + pc);
		    return 1;
		}
		cycle ++; // putting this down here is a kludge so that it doesn't count while polling for keypresses
	    }
	    // set up a callback to ourself, to occur ASAP
	    setTimeout(self.execute, 0);

	}
    }
}

function load_image(filename) {
    machine = makeMachine();

    my_div.innerHTML = "Loading <tt>" + filename + "</tt><br/>";

    xhr = new XMLHttpRequest(); 
    xhr.onreadystatechange = function() {
	if (xhr.readyState == 4) {
	    my_div.innerHTML = '';
	    buffer = xhr.response;
//	    writeln("Read " + buffer.byteLength + " bytes");
	    var wordArray = new Uint32Array(buffer);
	    machine.load(wordArray);
	    machine.set_self(machine);
	    machine.execute();
	}
    }
    
    xhr.open("GET", filename, true);
    xhr.responseType = "arraybuffer";
    xhr.send(null);
}

// figure out what file the user selected and call load_image
function gogogadget(thing) {
    thing = document.image_selection.image;

    for (var i=0; i<thing.length; i++) { 
	if (thing[i].checked) {
	    filename = thing[i].value;
	    break;
	}
    }
    load_image(filename);
}
