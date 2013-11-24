"use strict";
/*
 * This file is part of IodineGBA
 *
 * Copyright (C) 2012-2013 Grant Galitz
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
function ImportSaveCallback(name) {
    try {
        var save = findValue("SAVE_" + name);
        if (save != null) {
            writeRedTemporaryText("Loaded save.");
            return base64ToArray(save);
        }
    }
    catch (error) {
        writeRedTemporaryText("Could not read save: " + error.message);
    }
    return null;
}
function ExportSave() {
    Iodine.exportSave();
}
function ExportSaveCallback(name, save) {
    if (name != "") {
        try {
            setValue("SAVE_" + name, arrayToBase64(save));
        }
        catch (error) {
            writeRedTemporaryText("Could not store save: " + error.message);
        }
    }
}
function registerSaveHandlers() {
    Iodine.attachSaveExportHandler(ExportSaveCallback);
    Iodine.attachSaveImportHandler(ImportSaveCallback);
}
function import_save(blobData) {
	blobData = decodeBlob(blobData);
	if (blobData && blobData.blobs) {
		if (blobData.blobs.length > 0) {
			for (var index = 0; index < blobData.blobs.length; ++index) {
				writeRedTemporaryText("Importing blob \"" + blobData.blobs[index].blobID + "\"");
				if (blobData.blobs[index].blobContent) {
                    setValue(blobData.blobs[index].blobID, JSON.parse(blobData.blobs[index].blobContent));
				}
				else if (blobData.blobs[index].blobID) {
					writeRedTemporaryText("Save file imported had blob \"" + blobData.blobs[index].blobID + "\" with no blob data interpretable.");
				}
				else {
					writeRedTemporaryText("Blob chunk information missing completely.");
				}
			}
		}
		else {
			writeRedTemporaryText("Could not decode the imported file.");
		}
	}
	else {
		writeRedTemporaryText("Could not decode the imported file.");
	}
}
function generateBlob(keyName, encodedData) {
	//Append the file format prefix:
	var saveString = "EMULATOR_DATA";
	var consoleID = "GameBoyAdvance";
	//Figure out the length:
	var totalLength = (saveString.length + 4 + (1 + consoleID.length)) + ((1 + keyName.length) + (4 + encodedData.length));
	//Append the total length in bytes:
	saveString += to_little_endian_word(totalLength);
	//Append the console ID text's length:
	saveString += to_byte(consoleID.length);
	//Append the console ID text:
	saveString += consoleID;
	//Append the blob ID:
	saveString += to_byte(keyName.length);
	saveString += keyName;
	//Now append the save data:
	saveString += to_little_endian_word(encodedData.length);
	saveString += encodedData;
	return saveString;
}
function generateMultiBlob(blobPairs) {
	var consoleID = "GameBoyAdvance";
	//Figure out the initial length:
	var totalLength = 13 + 4 + 1 + consoleID.length;
	//Append the console ID text's length:
	var saveString = to_byte(consoleID.length);
	//Append the console ID text:
	saveString += consoleID;
	var keyName = "";
	var encodedData = "";
	//Now append all the blobs:
	for (var index = 0; index < blobPairs.length; ++index) {
		keyName = blobPairs[index][0];
		encodedData = blobPairs[index][1];
		//Append the blob ID:
		saveString += to_byte(keyName.length);
		saveString += keyName;
		//Now append the save data:
		saveString += to_little_endian_word(encodedData.length);
		saveString += encodedData;
		//Update the total length:
		totalLength += 1 + keyName.length + 4 + encodedData.length;
	}
	//Now add the prefix:
	saveString = "EMULATOR_DATA" + to_little_endian_word(totalLength) + saveString;
	return saveString;
}
function decodeBlob(blobData) {
	/*Format is as follows:
     - 13 byte string "EMULATOR_DATA"
     - 4 byte total size (including these 4 bytes).
     - 1 byte Console type ID length
     - Console type ID text of 8 bit size
     blobs {
     - 1 byte blob ID length
     - blob ID text (Used to say what the data is (SRAM/freeze state/etc...))
     - 4 byte blob length
     - blob length of 32 bit size
     }
     */
	var length = blobData.length;
	var blobProperties = {};
	blobProperties.consoleID = null;
	var blobsCount = -1;
	blobProperties.blobs = [];
	if (length > 17) {
		if (blobData.substring(0, 13) == "EMULATOR_DATA") {
			var length = Math.min(((blobData.charCodeAt(16) & 0xFF) << 24) | ((blobData.charCodeAt(15) & 0xFF) << 16) | ((blobData.charCodeAt(14) & 0xFF) << 8) | (blobData.charCodeAt(13) & 0xFF), length);
			var consoleIDLength = blobData.charCodeAt(17) & 0xFF;
			if (length > 17 + consoleIDLength) {
				blobProperties.consoleID = blobData.substring(18, 18 + consoleIDLength);
				var blobIDLength = 0;
				var blobLength = 0;
				for (var index = 18 + consoleIDLength; index < length;) {
					blobIDLength = blobData.charCodeAt(index++) & 0xFF;
					if (index + blobIDLength < length) {
						blobProperties.blobs[++blobsCount] = {};
						blobProperties.blobs[blobsCount].blobID = blobData.substring(index, index + blobIDLength);
						index += blobIDLength;
						if (index + 4 < length) {
							blobLength = ((blobData.charCodeAt(index + 3) & 0xFF) << 24) | ((blobData.charCodeAt(index + 2) & 0xFF) << 16) | ((blobData.charCodeAt(index + 1) & 0xFF) << 8) | (blobData.charCodeAt(index) & 0xFF);
							index += 4;
							if (index + blobLength <= length) {
								blobProperties.blobs[blobsCount].blobContent =  blobData.substring(index, index + blobLength);
								index += blobLength;
							}
							else {
								writeRedTemporaryText("Blob length check failed, blob determined to be incomplete.");
								break;
							}
						}
						else {
							writeRedTemporaryText("Blob was incomplete, bailing out.");
							break;
						}
					}
					else {
						writeRedTemporaryText("Blob was incomplete, bailing out.");
						break;
					}
				}
			}
		}
	}
	return blobProperties;
}
function refreshStorageListing() {
	var keys = getLocalStorageKeys();
	var blobPairs = [];
	for (var index = 0; index < keys.length; ++index) {
		blobPairs[index] = [keys[index], JSON.stringify(findValue(keys[index]))];
	}
	this.href = "data:application/octet-stream;base64," + base64(generateMultiBlob(blobPairs));
	this.download = "gameboy_advance_saves.export";
}
function checkStorageLength() {
	try {
		return window.localStorage.length;
	}
	catch (error) {
		//An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
		return window.globalStorage[location.hostname].length;
	}
}
function getLocalStorageKeys() {
	var storageLength = checkStorageLength();
	var keysFound = [];
	var index = 0;
	var nextKey = null;
	while (index < storageLength) {
		nextKey = findKey(index++);
		if (nextKey !== null && nextKey.length > 0) {
			if (nextKey.substring(0,5) == "SAVE_") {
				keysFound.push(nextKey);
			}
		}
		else {
			break;
		}
	}
	return keysFound;
}
function findKey(keyNum) {
	try {
		return window.localStorage.key(keyNum);
	}
	catch (error) {
		//An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
		return window.globalStorage[location.hostname].key(keyNum);
	}
	return null;
}
function to_little_endian_word(str) {
	return to_little_endian_hword(str) + to_little_endian_hword(str >> 16);
}
function to_little_endian_hword(str) {
	return to_byte(str) + to_byte(str >> 8);
}
function to_byte(str) {
	return String.fromCharCode(str & 0xFF);
}
//Wrapper for localStorage getItem, so that data can be retrieved in various types.
function findValue(key) {
    try {
        if (window.localStorage.getItem(key) != null) {
            return JSON.parse(window.localStorage.getItem(key));
        }
    }
    catch (error) {
        //An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
        if (window.globalStorage[location.hostname].getItem(key) != null) {
            return JSON.parse(window.globalStorage[location.hostname].getItem(key));
        }
    }
    return null;
}
//Wrapper for localStorage setItem, so that data can be set in various types.
function setValue(key, value) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    }
    catch (error) {
        //An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
        window.globalStorage[location.hostname].setItem(key, JSON.stringify(value));
    }
}
//Wrapper for localStorage removeItem, so that data can be set in various types.
function deleteValue(key) {
    try {
        window.localStorage.removeItem(key);
    }
    catch (error) {
        //An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
        window.globalStorage[location.hostname].removeItem(key);
    }
}