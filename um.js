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
	window.scroll(0, document.body.scrollHeight + 50); // FIXME
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
    var free_arrays = new Array();

    var pc;                    // program counter, aka finger
    var self;
    var cycle = 0;

    // Reverse the order of the bytes in an unsigned 32 bit word
    function byteswap32(x) {
	/* This is a tad trickier than you would expect, since
	   Javascript stores numbers as floating point but casts to
	   SIGNED 32-bit integer to do bitwise operations.  In
	   particular, the leftmost bit should be set by
	   multiplication and not bit-shifting, to avoid triggering
	   the sign bit. */
	return (x >>> 24) +
	    ((x & 0x00ff0000) >>>  8) +
	    ((x & 0x0000ff00) <<  8) +
	    ((x & 0x000000ff) * 0x01000000); // ugh!
    }

    // Check whether the host is little-Endian
    function isLittleEndian() {
	/* Create two views of the same underlying bits in order
	   to sense the underlying endianness. */
	var buffer = new ArrayBuffer(4);
	var words = new Uint32Array(buffer);
	var bytes = new Uint8Array(buffer); 
	
	words[0] = 0xAABBCCDD;

	/* Big endian will have    bytes == {0xAA, 0xBB, 0xCC, 0xDD},
	   Little endian will have bytes == {0xDD, 0xCC, 0xBB, 0xAA} */
	return (bytes[0] == 0xDD);
    }

    // Set up the endianness-conversion functions
    var ntohl = isLittleEndian() ? 
	byteswap32 : function(x) {return x;};
    var htonl = ntohl;
    
    
    // superstitiously move these out of the main execution loop so that they 
    // are not being allocated on every cycle.
    var instruction = 0;
    var A = 0;
    var B = 0;
    var C = 0;
    var opcode = 0;

    function instr_condmove() {
	if (registers[C]) registers[A] = registers[B];
    }

    function instr_arrayindex() {
	registers[A] = ntohl(arrays[registers[B]][registers[C]]);
    }

    function instr_arrayamend() {
	arrays[registers[A]][registers[B]]=htonl(registers[C]);
    }

    function instr_add() {
	registers[A] = registers[B] + registers[C];
    }

    function instr_mult() {
	registers[A] = registers[B] * registers[C];
    }

    function instr_div() {
	registers[A] = registers[B] / registers[C];
    }

    function instr_nand() {
	registers[A] = ~(registers[B] & registers[C]);
    }

    function instr_alloc() {
	var new_array_num = 0;

	// check to see if there is an array index in the freed list
	if (free_arrays.length > 0) {
	    new_array_num = free_arrays.pop();
	} else {
	    new_array_num = arrays.length;
	    arrays[new_array_num] = null;
	}

	// check whether the existing buffer is OK, or make a new one
	if ((arrays[new_array_num] == null) || (arrays[new_array_num].length < registers[C])) {
	    arrays[new_array_num]  = new Uint32Array(registers[C]);
	} else {
	    // zero the array - where is memset?
	    for (var i=0; i<registers[C]; i++) 
		arrays[new_array_num][i] = 0;
	}

	registers[B] = new_array_num;
    }
    
    function instr_free() {
	// if the array is not too huge, keep it around
	if (arrays[registers[C]].length > 128) 
	    arrays[registers[C]] = null;
	free_arrays.push(registers[C]);
    }

    function instr_putchar() {
	putchar(registers[C]);
    }

    function instr_jump() {
	if (registers[B] != 0) {
	    arrays[0] =  new Uint32Array(arrays[registers[B]]);
	}
	pc = registers[C];	
    }


    function instr_loadimmediate() {
	A = (instruction >> 25) & 7;
	registers[A] = instruction & 0x1FFFFFF;
    }

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
	    for (var iterations=10000; iterations>0; iterations--) {

		/* Fetch */
		instruction = ntohl(arrays[0][pc]);
		
		/* Decode the instruction */    
 		opcode = instruction >>> 28;
		C =  instruction        & 7;
		B = (instruction >>> 3) & 7; 
		A = (instruction >>> 6) & 7;
		
		/* increment the program counter */
		pc ++;
		
		switch (opcode) {
		    
		case 0: /* Conditional Move */
		    instr_condmove();
		    break;
		    
		case 1: /* Array Index */
		    instr_arrayindex();
		    break;
		    
		case 2: /* Array Amendment */		
		    instr_arrayamend();
		    break;
		    
		case 3: /* Addition */
		    instr_add();
		    break;
		    
		case 4: /* Multiplication */
		    instr_mult();
		    break;
		    
		case 5: /* Division */
		    instr_div();
		    break;
		    
		case 6: /* NAND */
		    instr_nand();
		    break;
		    
		    /* Oher Operators */
		    
		case 7:  /* Halt */
		    writeln("Machine stopped.");
		    return;
		    
		case 8:  /* Allocation */
		    instr_alloc();
		    break;
		    
		case 9: /* Abandonment */
		    instr_free();
		    break;
		    
		case 10: /* Output */
		    instr_putchar();
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
		    instr_jump();
		    break;
		    
		    /* Special Operators. */
		case 13:
		    instr_loadimmediate();
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
