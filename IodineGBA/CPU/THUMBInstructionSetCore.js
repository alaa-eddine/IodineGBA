/* 
 * This file is part of IodineGBA
 *
 * Copyright (C) 2012 Grant Galitz
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 * The full license is available at http://www.gnu.org/licenses/gpl.html
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 */
function THUMBInstructionSet(CPUCore) {
	this.CPUCore = CPUCore;
	this.initialize();
}
THUMBInstructionSet.prototype.initialize = function () {
	this.IOCore = this.CPUCore.IOCore;
	this.wait = this.IOCore.wait;
	this.registers = this.CPUCore.registers;
	this.resetPipeline();
	this.compileInstructionMap();
}
THUMBInstructionSet.prototype.resetPipeline = function () {
	this.fetch = 0;
	this.decode = 0;
	this.execute = 0;
	this.pipelineInvalid = 0x3;
}
THUMBInstructionSet.prototype.guardHighRegisterWrite = function (address, data) {
	//Guard high register writing, as it may cause a branch:
	this.registers[address] = data;
	if (address == 15) {
		//We performed a branch:
		this.resetPipeline();
	}
}
THUMBInstructionSet.prototype.executeIteration = function () {
	//Push the new fetch access:
	this.fetch = this.wait.CPUGetOpcode16(this.registers[15]);
	//Increment The Program Counter:
	this.registers[15] = (this.registers[15] + 2) & -2;
	//Execute Instruction:
	this.executeTHUMB();
	//Update the pipelining state:
	this.execute = this.decode;
	this.decode = this.fetch;
}
THUMBInstructionSet.prototype.executeTHUMB = function () {
	if (this.pipelineInvalid == 0) {
		//No condition code:
		this.instructionMap[this.execute >> 10](this);
	}
	else {
		//Tick the pipeline invalidation:
		this.pipelineInvalid >>= 1;
	}
}
THUMBInstructionSet.prototype.LSLimm = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = (parentObj.execute >> 6) & 0x1F;
	if (offset > 0) {
		//CPSR Carry is set by the last bit shifted out:
		parentObj.CPUCore.CPSRCarry = (((source << (offset - 1)) & 0x80000000) != 0);
		//Perform shift:
		source <<= offset;
	}
	else {
		parentObj.CPUCore.CPSRCarry = false;
	}
	//Perform CPSR updates for N and Z (But not V):
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.LSRimm = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = (parentObj.execute >> 6) & 0x1F;
	if (offset > 0) {
		//CPSR Carry is set by the last bit shifted out:
		parentObj.CPUCore.CPSRCarry = (((source >>> (offset - 1)) & 0x1) != 0);
		//Perform shift:
		source >>>= offset;
	}
	else {
		parentObj.CPUCore.CPSRCarry = false;
	}
	//Perform CPSR updates for N and Z (But not V):
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.ASRimm = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = (parentObj.execute >> 6) & 0x1F;
	if (offset > 0) {
		//CPSR Carry is set by the last bit shifted out:
		parentObj.CPUCore.CPSRCarry = (((source >> (offset - 1)) & 0x1) != 0);
		//Perform shift:
		source >>= offset;
	}
	else {
		parentObj.CPUCore.CPSRCarry = false;
	}
	//Perform CPSR updates for N and Z (But not V):
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.ADDreg = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = parentObj.registers[(parentObj.execute >> 6) & 0x7];
	//Perform Addition:
	var dirtyResult = source + offset;
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) != dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = dirtyResult;
}
THUMBInstructionSet.prototype.SUBreg = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = parentObj.registers[(parentObj.execute >> 6) & 0x7];
	//Perform Subtraction:
	var dirtyResult = source - offset;
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) == dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = dirtyResult;
}
THUMBInstructionSet.prototype.ADDimm3 = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = (parentObj.execute >> 6) & 0x7;
	//Perform Addition:
	var dirtyResult = source + offset;
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) != dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = dirtyResult;
}
THUMBInstructionSet.prototype.SUBimm3 = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = (parentObj.execute >> 6) & 0x7;
	//Perform Subtraction:
	var dirtyResult = source - offset;
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) == dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = dirtyResult;
}
THUMBInstructionSet.prototype.MOVimm8 = function (parentObj) {
	//Get the 8-bit value to move into the register:
	var result = parentObj.execute & 0xFF;
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.registers[(parentObj.execute >> 8) & 0x7] = result;
}
THUMBInstructionSet.prototype.CMPimm8 = function (parentObj) {
	//Compare an 8-bit immediate value with a register:
	var source = parentObj.registers[(parentObj.execute >> 8) & 0x7];
	var dirtyResult = source - (parentObj.execute & 0xFF);
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((source ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.ADDimm8 = function (parentObj) {
	//Add an 8-bit immediate value with a register:
	var source = parentObj.registers[(parentObj.execute >> 8) & 0x7];
	var dirtyResult = source + (parentObj.execute & 0xFF);
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result != dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((source ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	parentObj.registers[(parentObj.execute >> 8) & 0x7] = result;
}
THUMBInstructionSet.prototype.SUBimm8 = function (parentObj) {
	//Subtract an 8-bit immediate value from a register:
	var source = parentObj.registers[(parentObj.execute >> 8) & 0x7];
	var dirtyResult = source - (parentObj.execute & 0xFF);
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((source ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	parentObj.registers[(parentObj.execute >> 8) & 0x7] = result;
}
THUMBInstructionSet.prototype.AND = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform bitwise AND:
	var result = source & destination;
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = result;
}
THUMBInstructionSet.prototype.EOR = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform bitwise EOR:
	var result = source ^ destination;
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = result;
}
THUMBInstructionSet.prototype.LSL = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7] & 0x1F;
	if (destination > 0) {
		//CPSR Carry is set by the last bit shifted out:
		parentObj.CPUCore.CPSRCarry = (((source << (destination - 1)) & 0x80000000) != 0);
		//Perform shift:
		source <<= destination;
	}
	else {
		parentObj.CPUCore.CPSRCarry = false;
	}
	//Perform CPSR updates for N and Z (But not V):
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.LSR = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7] & 0x1F;
	if (destination > 0) {
		//CPSR Carry is set by the last bit shifted out:
		parentObj.CPUCore.CPSRCarry = (((source >>> (destination - 1)) & 0x1) != 0);
		//Perform shift:
		source >>>= destination;
	}
	else {
		parentObj.CPUCore.CPSRCarry = false;
	}
	//Perform CPSR updates for N and Z (But not V):
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.ASR = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7] & 0x1F;
	if (destination > 0) {
		//CPSR Carry is set by the last bit shifted out:
		parentObj.CPUCore.CPSRCarry = (((source >>> (destination - 1)) & 0x1) != 0);
		//Perform shift:
		source >>= destination;
	}
	else {
		parentObj.CPUCore.CPSRCarry = false;
	}
	//Perform CPSR updates for N and Z (But not V):
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.ADC = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7] + ((parentObj.CPUCore.CPSRCarry) ? 1 : 0);
	//Perform Addition:
	var dirtyResult = source + destination;
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) != dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = dirtyResult;
}
THUMBInstructionSet.prototype.SBC = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var offset = parentObj.registers[parentObj.execute & 0x7];
	//Perform Subtraction:
	var dirtyResult = source - offset - ((parentObj.CPUCore.CPSRCarry) ? 0 : 1);
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) == dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = dirtyResult;
}
THUMBInstructionSet.prototype.ROR = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7] & 0x1F;
	if (destination > 0) {
		//CPSR Carry is set by the last bit shifted out:
		parentObj.CPUCore.CPSRCarry = (((source >>> (destination - 1)) & 0x1) != 0);
		//Perform rotate:
		source = (source << (0x20 - destination)) | (source >>> destination);
	}
	else {
		parentObj.CPUCore.CPSRCarry = false;
	}
	//Perform CPSR updates for N and Z (But not V):
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.TST = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform bitwise AND:
	var result = source & destination;
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.NEG = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSROverflow = ((source ^ (-source)) < 0);
	//Perform Subtraction:
	source = (-source) | 0;
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.CMP = function (parentObj) {
	//Compare two registers:
	var destination = parentObj.registers[parentObj.execute & 0x7];
	var dirtyResult = destination - parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((destination ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.CMN = function (parentObj) {
	//Compare two registers:
	var destination = parentObj.registers[parentObj.execute & 0x7];
	var dirtyResult = destination + parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((destination ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.ORR = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform bitwise ORR:
	var result = source | destination;
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = result;
}
THUMBInstructionSet.prototype.MUL = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform MUL32:
	var result = parentObj.CPUCore.performMUL32(source, destination);
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = result;
}
THUMBInstructionSet.prototype.BIC = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform bitwise AND with a bitwise NOT on source:
	var result = ~source & destination;
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = result;
}
THUMBInstructionSet.prototype.MVN = function (parentObj) {
	//Perform bitwise NOT on source:
	var source = ~parentObj.registers[(parentObj.execute >> 3) & 0x7];
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (source < 0);
	parentObj.CPUCore.CPSRZero = (source == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = source;
}
THUMBInstructionSet.prototype.ADDH_LL = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform Addition:
	var dirtyResult = source + destination;
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) != dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = dirtyResult;
}
THUMBInstructionSet.prototype.ADDH_LH = function (parentObj) {
	var source = parentObj.registers[0x8 | ((parentObj.execute >> 3) & 0x7)];
	var destination = parentObj.registers[parentObj.execute & 0x7];
	//Perform Addition:
	var dirtyResult = source + destination;
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) != dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.registers[parentObj.execute & 0x7] = dirtyResult;
}
THUMBInstructionSet.prototype.ADDH_HL = function (parentObj) {
	var source = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var destination = parentObj.registers[0x8 | (parentObj.execute & 0x7)];
	//Perform Addition:
	var dirtyResult = source + destination;
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) != dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.guardHighRegisterWrite(0x8 | (parentObj.execute & 0x7), dirtyResult);
}
THUMBInstructionSet.prototype.ADDH_HH = function (parentObj) {
	var source = parentObj.registers[0x8 | ((parentObj.execute >> 3) & 0x7)];
	var destination = parentObj.registers[0x8 | (parentObj.execute & 0x7)];
	//Perform Addition:
	var dirtyResult = source + destination;
	parentObj.CPUCore.CPSRCarry = ((dirtyResult | 0) != dirtyResult);
	dirtyResult |= 0;
	parentObj.CPUCore.CPSROverflow = ((source ^ dirtyResult) < 0);
	parentObj.CPUCore.CPSRNegative = (dirtyResult < 0);
	parentObj.CPUCore.CPSRZero = (dirtyResult == 0);
	//Update destination register:
	parentObj.guardHighRegisterWrite(0x8 | (parentObj.execute & 0x7), dirtyResult);
}
THUMBInstructionSet.prototype.CMPH_LL = function (parentObj) {
	//Compare two registers:
	var destination = parentObj.registers[parentObj.execute & 0x7];
	var dirtyResult = destination - parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((destination ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.CMPH_LH = function (parentObj) {
	//Compare two registers:
	var destination = parentObj.registers[parentObj.execute & 0x7];
	var dirtyResult = destination - parentObj.registers[0x8 | ((parentObj.execute >> 3) & 0x7)];
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((destination ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.CMPH_HL = function (parentObj) {
	//Compare two registers:
	var destination = parentObj.registers[0x8 | (parentObj.execute & 0x7)];
	var dirtyResult = destination - parentObj.registers[(parentObj.execute >> 3) & 0x7];
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((destination ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.CMPH_HH = function (parentObj) {
	//Compare two registers:
	var destination = parentObj.registers[0x8 | (parentObj.execute & 0x7)];
	var dirtyResult = destination - parentObj.registers[0x8 | ((parentObj.execute >> 3) & 0x7)];
	var result = dirtyResult | 0;
	parentObj.CPUCore.CPSRCarry = (result == dirtyResult);
	parentObj.CPUCore.CPSROverflow = ((destination ^ result) < 0);
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
}
THUMBInstructionSet.prototype.MOVH_LL = function (parentObj) {
	//Move a register to another register:
	var result = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	parentObj.registers[parentObj.execute & 0x7] = result;
}
THUMBInstructionSet.prototype.MOVH_LH = function (parentObj) {
	//Move a register to another register:
	var result = parentObj.registers[0x8 | ((parentObj.execute >> 3) & 0x7)];
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	parentObj.registers[parentObj.execute & 0x7] = result;
}
THUMBInstructionSet.prototype.MOVH_HL = function (parentObj) {
	//Move a register to another register:
	var result = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	parentObj.guardHighRegisterWrite(0x8 | (parentObj.execute & 0x7), result);
}
THUMBInstructionSet.prototype.MOVH_HH = function (parentObj) {
	//Move a register to another register:
	var result = parentObj.registers[0x8 | ((parentObj.execute >> 3) & 0x7)];
	parentObj.CPUCore.CPSRCarry = false;
	parentObj.CPUCore.CPSRNegative = (result < 0);
	parentObj.CPUCore.CPSRZero = (result == 0);
	parentObj.guardHighRegisterWrite(0x8 | (parentObj.execute & 0x7), result);
}
THUMBInstructionSet.prototype.BX_L = function (parentObj) {
	//Branch & eXchange:
	var address = parentObj.registers[(parentObj.execute >> 3) & 0x7];
	if ((address & 0x1) == 0) {
		//Enter ARM mode:
		parentObj.CPUCore.enterARM();
		address &= -4;
	}
	else {
		//Stay in THUMB mode:
		parentObj.resetPipeline();
		address &= -2;
	}
	parentObj.registers[15] = address;
}
THUMBInstructionSet.prototype.BX_H = function (parentObj) {
	//Branch & eXchange:
	var address = parentObj.registers[0x8 | ((parentObj.execute >> 3) & 0x7)];
	if ((address & 0x1) == 0) {
		//Enter ARM mode:
		parentObj.CPUCore.enterARM();
		address &= -4;
	}
	else {
		//Stay in THUMB mode:
		parentObj.resetPipeline();
		address &= -2;
	}
	parentObj.registers[15] = address;
}
THUMBInstructionSet.prototype.LDRPC = function (parentObj) {
	//PC-Relative Load
	var result = parentObj.IOCore.memoryRead32(parentObj.registers[15] + ((parentObj.execute & 0xFF) << 2));
	parentObj.guardHighRegisterWrite((parentObj.execute >> 8) & 0x7, result);
}
THUMBInstructionSet.prototype.STRreg = function (parentObj) {
	//Store Word From Register
	parentObj.IOCore.memoryWrite32(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7], parentObj.registers[parentObj.execute & 0x7]);
}
THUMBInstructionSet.prototype.STRHreg = function (parentObj) {
	//Store Hald-Word From Register
	parentObj.IOCore.memoryWrite16(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7], parentObj.registers[parentObj.execute & 0x7]);
}
THUMBInstructionSet.prototype.STRBreg = function (parentObj) {
	//Store Byte From Register
	parentObj.IOCore.memoryWrite8(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7], parentObj.registers[parentObj.execute & 0x7]);
}
THUMBInstructionSet.prototype.LDRSBreg = function (parentObj) {
	//Load Signed Byte Into Register
	parentObj.registers[parentObj.execute & 0x7] = (parentObj.IOCore.memoryRead8(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7]) << 24) >> 24;
}
THUMBInstructionSet.prototype.LDRreg = function (parentObj) {
	//Load Word Into Register
	parentObj.registers[parentObj.execute & 0x7] = parentObj.IOCore.memoryRead32(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7]);
}
THUMBInstructionSet.prototype.LDRHreg = function (parentObj) {
	//Load Half-Word Into Register
	parentObj.registers[parentObj.execute & 0x7] = parentObj.IOCore.memoryRead16(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7]);
}
THUMBInstructionSet.prototype.LDRBreg = function (parentObj) {
	//Load Byte Into Register
	parentObj.registers[parentObj.execute & 0x7] = parentObj.IOCore.memoryRead8(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7]);
}
THUMBInstructionSet.prototype.LDRSHreg = function (parentObj) {
	//Load Signed Half-Word Into Register
	parentObj.registers[parentObj.execute & 0x7] = (parentObj.IOCore.memoryRead16(parentObj.registers[(parentObj.execute >> 6) & 0x7] + parentObj.registers[(parentObj.execute >> 3) & 0x7]) << 16) >> 16;
}
THUMBInstructionSet.prototype.STRimm5 = function (parentObj) {
	//Store Word From Register
	parentObj.IOCore.memoryWrite32((((parentObj.execute >> 6) & 0x1F) << 2) + parentObj.registers[(parentObj.execute >> 3) & 0x7], parentObj.registers[parentObj.execute & 0x7]);
}
THUMBInstructionSet.prototype.LDRimm5 = function (parentObj) {
	//Load Word Into Register
	parentObj.registers[parentObj.execute & 0x7] = parentObj.IOCore.memoryRead32((((parentObj.execute >> 6) & 0x1F) << 2) + parentObj.registers[(parentObj.execute >> 3) & 0x7]);
}
THUMBInstructionSet.prototype.STRBimm5 = function (parentObj) {
	//Store Byte From Register
	parentObj.IOCore.memoryWrite8(((parentObj.execute >> 6) & 0x1F) + parentObj.registers[(parentObj.execute >> 3) & 0x7], parentObj.registers[parentObj.execute & 0x7]);
}
THUMBInstructionSet.prototype.LDRBimm5 = function (parentObj) {
	//Load Byte Into Register
	parentObj.registers[parentObj.execute & 0x7] = parentObj.IOCore.memoryRead8(((parentObj.execute >> 6) & 0x1F) + parentObj.registers[(parentObj.execute >> 3) & 0x7]);
}
THUMBInstructionSet.prototype.STRHimm5 = function (parentObj) {
	//Store Half-Word From Register
	parentObj.IOCore.memoryWrite16((((parentObj.execute >> 6) & 0x1F) << 1) + parentObj.registers[(parentObj.execute >> 3) & 0x7], parentObj.registers[parentObj.execute & 0x7]);
}
THUMBInstructionSet.prototype.LDRHimm5 = function (parentObj) {
	//Load Half-Word Into Register
	parentObj.registers[parentObj.execute & 0x7] = parentObj.IOCore.memoryRead16((((parentObj.execute >> 6) & 0x1F) << 1) + parentObj.registers[(parentObj.execute >> 3) & 0x7]);
}
THUMBInstructionSet.prototype.STRSP = function (parentObj) {
	//Store Word From Register
	parentObj.IOCore.memoryWrite32(((parentObj.execute & 0xFF) << 2) + parentObj.registers[13], parentObj.registers[(parentObj.execute >> 8) & 0x7]);
}
THUMBInstructionSet.prototype.LDRSP = function (parentObj) {
	//Load Word Into Register
	parentObj.registers[(parentObj.execute >> 8) & 0x7] = parentObj.IOCore.memoryRead32((parentObj.registers[parentObj.execute & 0xFF] << 2) + parentObj.registers[13]);
}
THUMBInstructionSet.prototype.compileInstructionMap = function () {
	this.instructionMap = [];
	//0-7
	this.generateLowMap(this.LSLimm);
	//8-F
	this.generateLowMap(this.LSRimm);
	//10-17
	this.generateLowMap(this.ASRimm);
	//18-19
	this.generateLowMap2(this.ADDreg);
	//1A-1B
	this.generateLowMap2(this.SUBreg);
	//1C-1D
	this.generateLowMap2(this.ADDimm3);
	//1E-1F
	this.generateLowMap2(this.SUBimm3);
	//20-27
	this.generateLowMap(this.MOVimm8);
	//28-2F
	this.generateLowMap(this.CMPimm8);
	//30-37
	this.generateLowMap(this.ADDimm8);
	//38-3F
	this.generateLowMap(this.SUBimm8);
	//40
	this.generateLowMap4(this.AND, this.EOR, this.LSL, this.LSR);
	//41
	this.generateLowMap4(this.ASR, this.ADC, this.SBC, this.ROR);
	//42
	this.generateLowMap4(this.TST, this.NEG, this.CMP, this.CMN);
	//43
	this.generateLowMap4(this.ORR, this.MUL, this.BIC, this.MVN);
	//44
	this.generateLowMap4(this.ADDH_LL, this.ADDH_LH, this.ADDH_HL, this.ADDH_HH);
	//45
	this.generateLowMap4(this.CMPH_LL, this.CMPH_LH, this.CMPH_HL, this.CMPH_HH);
	//46
	this.generateLowMap4(this.MOVH_LL, this.MOVH_LH, this.MOVH_HL, this.MOVH_HH);
	//47
	this.generateLowMap4(this.BX_L, this.BX_H, this.BX_L, this.BX_H);
	//48-4F
	this.generateLowMap(this.LDRPC);
	//50-51
	this.generateLowMap2(this.STRreg);
	//52-53
	this.generateLowMap2(this.STRHreg);
	//54-55
	this.generateLowMap2(this.STRBreg);
	//56-57
	this.generateLowMap2(this.LDRSBreg);
	//58-59
	this.generateLowMap2(this.LDRreg);
	//5A-5B
	this.generateLowMap2(this.LDRHreg);
	//5C-5D
	this.generateLowMap2(this.LDRBreg);
	//5E-5F
	this.generateLowMap2(this.LDRSHreg);
	//60-67
	this.generateLowMap(this.STRimm5);
	//68-6F
	this.generateLowMap(this.LDRimm5);
	//70-77
	this.generateLowMap(this.STRBimm5);
	//78-7F
	this.generateLowMap(this.LDRBimm5);
	//80-87
	this.generateLowMap(this.STRHimm5);
	//88-8F
	this.generateLowMap(this.LDRHimm5);
	//90-97
	this.generateLowMap(this.STRSP);
	//98-9F
	this.generateLowMap(this.LDRSP);
	//A0
	this.generateLowMap3(this.ADDPCr0);
	//A1
	this.generateLowMap3(this.ADDPCr1);
	//A2
	this.generateLowMap3(this.ADDPCr2);
	//A3
	this.generateLowMap3(this.ADDPCr3);
	//A4
	this.generateLowMap3(this.ADDPCr4);
	//A5
	this.generateLowMap3(this.ADDPCr5);
	//A6
	this.generateLowMap3(this.ADDPCr6);
	//A7
	this.generateLowMap3(this.ADDPCr7);
	//A8
	this.generateLowMap3(this.ADDSPr0);
	//A9
	this.generateLowMap3(this.ADDSPr1);
	//AA
	this.generateLowMap3(this.ADDSPr2);
	//AB
	this.generateLowMap3(this.ADDSPr3);
	//AC
	this.generateLowMap3(this.ADDSPr4);
	//AD
	this.generateLowMap3(this.ADDSPr5);
	//AE
	this.generateLowMap3(this.ADDSPr6);
	//AF
	this.generateLowMap3(this.ADDSPr7);
	//B0
	this.generateLowMap3(this.ADDSPimm7);
	//B1
	this.generateLowMap3(this.UNDEFINED);
	//B2
	this.generateLowMap3(this.UNDEFINED);
	//B3
	this.generateLowMap3(this.UNDEFINED);
	//B4
	this.generateLowMap3(this.PUSH);
	//B5
	this.generateLowMap3(this.PUSHlr);
	//B6
	this.generateLowMap3(this.UNDEFINED);
	//B7
	this.generateLowMap3(this.UNDEFINED);
	//B8
	this.generateLowMap3(this.UNDEFINED);
	//B9
	this.generateLowMap3(this.UNDEFINED);
	//BA
	this.generateLowMap3(this.UNDEFINED);
	//BB
	this.generateLowMap3(this.UNDEFINED);
	//BC
	this.generateLowMap3(this.POP);
	//BD
	this.generateLowMap3(this.POPpc);
	//BE
	this.generateLowMap3(this.UNDEFINED);
	//BF
	this.generateLowMap3(this.UNDEFINED);
	//C0
	this.generateLowMap3(this.STMIAr0);
	//C1
	this.generateLowMap3(this.STMIAr1);
	//C2
	this.generateLowMap3(this.STMIAr2);
	//C3
	this.generateLowMap3(this.STMIAr3);
	//C4
	this.generateLowMap3(this.STMIAr4);
	//C5
	this.generateLowMap3(this.STMIAr5);
	//C6
	this.generateLowMap3(this.STMIAr6);
	//C7
	this.generateLowMap3(this.STMIAr7);
	//C8
	this.generateLowMap3(this.LDMIAr0);
	//C9
	this.generateLowMap3(this.LDMIAr1);
	//CA
	this.generateLowMap3(this.LDMIAr2);
	//CB
	this.generateLowMap3(this.LDMIAr3);
	//CC
	this.generateLowMap3(this.LDMIAr4);
	//CD
	this.generateLowMap3(this.LDMIAr5);
	//CE
	this.generateLowMap3(this.LDMIAr6);
	//CF
	this.generateLowMap3(this.LDMIAr7);
	//D0
	this.generateLowMap3(this.BEQ);
	//D1
	this.generateLowMap3(this.BNE);
	//D2
	this.generateLowMap3(this.BCS);
	//D3
	this.generateLowMap3(this.BCC);
	//D4
	this.generateLowMap3(this.BMI);
	//D5
	this.generateLowMap3(this.BPL);
	//D6
	this.generateLowMap3(this.BVS);
	//D7
	this.generateLowMap3(this.BVC);
	//D8
	this.generateLowMap3(this.BHI);
	//D9
	this.generateLowMap3(this.BLS);
	//DA
	this.generateLowMap3(this.BGE);
	//DB
	this.generateLowMap3(this.BLT);
	//DC
	this.generateLowMap3(this.BGT);
	//DD
	this.generateLowMap3(this.BLE);
	//DE
	this.generateLowMap3(this.UNDEFINED);
	//DF
	this.generateLowMap3(this.SWI);
	//E0-E7
	this.generateLowMap(this.B);
	//E8-EF
	this.generateLowMap(this.UNDEFINED);
	//F0-F7
	this.generateLowMap(this.BLsetup);
	//F8-FF
	this.generateLowMap(this.BLoff);
}
THUMBInstructionSet.prototype.generateLowMap = function (instruction) {
	for (var index = 0; index < 0x20; ++index) {
		this.instructionMap.push(instruction);
	}
}
THUMBInstructionSet.prototype.generateLowMap2 = function (instruction) {
	for (var index = 0; index < 0x8; ++index) {
		this.instructionMap.push(instruction);
	}
}
THUMBInstructionSet.prototype.generateLowMap3 = function (instruction) {
	for (var index = 0; index < 0x4; ++index) {
		this.instructionMap.push(instruction);
	}
}
THUMBInstructionSet.prototype.generateLowMap4 = function (instruction1, instruction2, instruction3, instruction4) {
	this.instructionMap.push(instruction1);
	this.instructionMap.push(instruction2);
	this.instructionMap.push(instruction3);
	this.instructionMap.push(instruction4);
}