my_div = document.getElementById("hello_area");
my_div.innerHTML = "Hello, World<br/>";

function putchar(c) {
    var s;
    switch (c) {
    case 10: 
	s = "<br/>";
	break;
    default:
	s = String.fromCharCode(c);
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
    
    function byteswap(x) {
	return (x >>> 24) +
	    ((x & 0x00ff0000) >>>  8) +
	    ((x & 0x0000ff00) <<  8) +
	    ((x & 0x000000ff) * 0x01000000); // ugh!
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
	    for (var iterations=1000; iterations>0; iterations--) {

		/* Fetch */
		var instruction = byteswap(arrays[0][pc]);
		
		/* Decode the instruction */    
 		var opcode = instruction >>> 28;
		var C =  instruction        & 7;
		var B = (instruction >>> 3) & 7; 
		var A = (instruction >>> 6) & 7;
		
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
		    //		int i = getchar();
		    registers[C] = ~0;
		    return; //FIXME
		    break;
		    
		case 12: /* Load Program. */		
		    var src_array = registers[B];  // index of array to load into array[0]
		    if (src_array != 0) {
			arrays[0] =  new Uint32Array(arrays[src_array]);
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
	    }
	    setTimeout(self.execute, 0);
	}
    }
}

machine = makeMachine();

xhr = new XMLHttpRequest(); 
xhr.onreadystatechange = function() {
//    writeln("onReadyStateChange()");
    if (xhr.readyState == 4) {
	buffer = xhr.response;
	writeln("Read " + buffer.byteLength + " bytes");
	var wordArray = new Uint32Array(buffer);
	machine.load(wordArray);
	machine.set_self(machine);
	machine.execute();
    }
}

xhr.open("GET", "sandmark.umz", true);
xhr.responseType = "arraybuffer";
xhr.send(null);