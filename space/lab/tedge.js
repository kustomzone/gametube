// tedge.js: 3D games in javascript
// v 0.01

var gl;
var shader;
var canvas;
var canvas2D;
var context;
var entities = [];

// input
var K_LEFT = false;
var K_RIGHT = false;
var K_UP = false;
var K_DOWN = false;
var K_SPACE = false;
var K_KONAMI = false;
var KONAMI_CODE = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];

// graphics
var gCamera;
var gTextures = {};

var vMatrix;
var wMatrix = mat4.create();
var pMatrix = mat4.create();
var STD_SHADER;

var cos = Math.cos;
var sin = Math.sin;
var tan = Math.tan;
var abs = Math.abs;

// timing
var lastT;
var curT;

// start the tEdgine
function run()
{
	// init graphics
	initGL();
	
	// init input
	document.onkeydown = onKeyDown;
	document.onkeyup = onKeyUp;
	
	// init game stuffs
	gameInit();
}

//////////////////////////////////////////////////////
// GAME MANAGEMENT
//////////////////////////////////////////////////////

function connect()
{
	return 0;
}

function receive(type, arg)
{
	var e = type(arg);
	entities.push(e);
	return e;
}

function receiveAll(type, N, arg)
{
	if (N === undefined)
		return;

	var list = [];
	for (var i = 0; i < N; i++)
	{
		var e = type(arg);
		list.push(e);
		entities.push(e);
	}
	return list;
}

function receiveNew(type, arg)
{
	var e = type(arg);
	entities.push(e);
	return e;
}


//////////////////////////////////////////////////////
// GRAPHICS
//////////////////////////////////////////////////////

window.requestAnimFrame = (function() 
{
	return window.requestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.oRequestAnimationFrame ||
		window.msRequestAnimationFrame ||
		function(/* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
			window.setTimeout(callback, 1000/30);
		};
})();

// startup
function initGL()
{
	// find the canvas
	canvas = document.getElementById("game");
	canvas.width = document.body.clientWidth;
	canvas.height = document.body.clientHeight;
	
	// get gl context
	try {
		gl = canvas.getContext("webgl") ||
			canvas.getContext("experimental-webgl") ||
			canvas.getContext("webkit-3d") ||
			canvas.getContext("moz-webgl");
		gl.viewportWidth = canvas.width;
		gl.viewportHeight = canvas.height;
	} catch (e) {
	}
	if (!gl)
	{
		alert("Sorry, WebGL not supported.");
	}
	
	// get 2D context
	try {
		canvas2D = document.getElementById("2D");
		canvas2D.width = 512;
		canvas2D.height = 512;
		context = canvas2D.getContext("2d");
	} catch (e) {
	}
	if (!context)
	{
		alert("Could not bind 2D context.");
	}
	
	// load & compile shaders
	initShaders();
	
	// set up gl default state
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);
	
	// perspective
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);	
	mat4.perspective(55, gl.viewportWidth / gl.viewportHeight, 0.3, 400.0, pMatrix);
	gl.uniformMatrix4fv(STD_SHADER.pMatrix, false, pMatrix);
}

// render loop
function render()
{	
	// clear screen
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// set the camera
	vMatrix = gCamera.getMatrix();
	gl.uniformMatrix4fv(STD_SHADER.vMatrix, false, vMatrix);
	
	// render errything
	for (ent in entities)
	{	
		if (entities[ent].render)
		{
			mat4.identity(wMatrix);
			entities[ent].render(wMatrix);
		}
	}
}

// TEXTURES: /////////////////////////////////////////

function loadTexture(file)
{
	// prevent duplicate loading
	if (gTextures[file])
		return gTextures[file];
	
	var texture = gl.createTexture();
	texture.image = new Image();
	texture.image.onload = function() {
		handleLoadedTexture(texture)
	}
	texture.image.src = file;
	
	gTextures[file] = texture;
	return texture;
}

function setTexture(texture)
{
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.uniform1i(STD_SHADER.samplerUniform, 0);
}

function handleLoadedTexture(texture)
{
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, texture.image);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.bindTexture(gl.TEXTURE_2D, null);
}

function StoreTexture(texture, bitmap) 
{
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.bindTexture(gl.TEXTURE_2D, null);
}

// MESHES: /////////////////////////////////////////

// load json mesh into video memory
function BufferMesh(mesh)
{
	// prevent duplicate loading
	if (mesh.buffered)
		return mesh;
	
	mesh.vert_buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vert_buf);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.vertices), gl.STATIC_DRAW);
	
	if (mesh.uvs)
	{
		mesh.uv_buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv_buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.uvs), gl.STATIC_DRAW);
	}
	
	if (mesh.normals)
	{
		mesh.norm_buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.norm_buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.normals), gl.STATIC_DRAW);
	}
	
	mesh.buffered = true;
	return mesh;
}

function DrawMesh(mesh, worldMtx, shader)
{
	if (shader === undefined) shader = STD_SHADER;
	// set vertex position array buffer
	gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vert_buf);
	gl.vertexAttribPointer(shader.vertPos, 3, gl.FLOAT, false, 0, 0);
	
	// set normal array buffer
	if (mesh.norm_buf && shader.vertNorm !== undefined)
	{
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.norm_buf);
		gl.vertexAttribPointer(shader.vertNorm, 3, gl.FLOAT, false, 0, 0);
	}
	
	// set UV array buffer
	if (mesh.uv_buf && shader.texCoord !== undefined)
	{
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv_buf);
		gl.vertexAttribPointer(shader.texCoord, 2, gl.FLOAT, false, 0, 0);
	}
	
	// set world matrix
	gl.uniformMatrix4fv(shader.wMatrix, false, worldMtx);

	// do it
	gl.drawArrays(gl.TRIANGLES, 0, mesh.count * 3);
}

// more mesh functions
// [u'] = [a b][u] + [e]
// [v'] = [c d][v] + [f]
function MeshTransformUVs(mesh, affineMatrix) {
	for (var i = 0; i < mesh.uvs.length; i+=2) {
		var u = mesh.uvs[i]; var v = mesh.uvs[i+1];
		mesh.uvs[i] = affineMatrix[0]*u + affineMatrix[1]*v + affineMatrix[2];
		mesh.uvs[i+1] = affineMatrix[3]*u + affineMatrix[4]*v + affineMatrix[5];
	}
}


//////////////////////////////////////////////////////
// INPUT
//////////////////////////////////////////////////////
var keysDown = {};
var lastKeys = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

var K_DOWN  = 40;
var K_RIGHT = 39;
var K_UP	= 38;
var K_LEFT  = 37;
var K_SPACE = 32;

function InputtingEntity(e, player)
{
	e.keyDown = function (key)
	{
		return (player == puid && (key in keysDown));
	}
	
	return e;
}

// input
function onKeyDown(evt) 
{
	if (!evt) evt = window.event;
	
	keysDown[evt.keyCode] = true;

	lastKeys.push(evt.keyCode);
	lastKeys.splice(0, 1);
	K_KONAMI = true;
	for (var i = 0; i < 10; i++)
		if (lastKeys[i] != KONAMI_CODE[i])
			K_KONAMI = false;
}

function onKeyUp(evt) 
{
	if (!evt) evt = window.event;
	if (evt.keyCode in keysDown)
		delete keysDown[evt.keyCode];
}

//////////////////////////////////////////////////////
// GAME
//////////////////////////////////////////////////////

function startGame()
{
	// set the clock
	curT = new Date().getTime();
	gameLoop();
}

// main loop
function gameLoop()
{
	window.requestAnimFrame(gameLoop, canvas);
	render();

	lastT = curT;
	curT = new Date().getTime();
	var dt = (curT - lastT)/1000.0;
	
	if (dt > 1.0)
		dt = 1.0;
	
	update(dt);
	Physics(dt);
	//setTimeout(gameLoop, 0);
}

function update(dt)
{	
	for (ent in entities)
	{
		if (entities[ent].update)
		{
			entities[ent].update(dt);
		}
	}
}

function removeEntity(e)
{
	var idx = entities.indexOf(e);
	if (idx != -1) 
		entities.splice(idx, 1);

	// destructor
	if (e.destroy) 
		e.destroy();
}

function TransformMesh(mesh, mtx)
{
	mesh.vertices = Mat4TransformPoints(mesh.vertices, mtx);
	mesh.normals = Mat3TransformPoints(mesh.vertices, mtx);
	return mesh;
}

function StaticEntity(mesh, mdlMtx)
{
	if (mdlMtx)
	{   
		var origMesh = mesh;
		mesh = {uvs: origMesh.uvs, count: origMesh.count};
		mesh.vertices = Mat4TransformPoints(origMesh.vertices, mdlMtx);
		mesh.normals  = Mat3TransformPoints(origMesh.normals, mdlMtx);
	}
	
	BufferMesh(mesh);
	
	var e = PhysicalEntity({}, mesh, false);
	e.shader = STD_SHADER;
	
	e.render = function(mtx)
	{
		mat4.set(Mat4List(e.matrix), mtx);
		DrawMesh(e.mesh, mtx, e.shader);
	}
	
	return e;
}

function DynamicEntity(origMesh, mdlMtx)
{
	var mesh;
	if (mdlMtx)
	{   
		mesh = {uvs: origMesh.uvs, count: origMesh.count};
		mesh.vertices = Mat4TransformPoints(origMesh.vertices, mdlMtx);
		mesh.normals  = Mat3TransformPoints(origMesh.normals, mdlMtx);
	}
	else
		mesh = origMesh;
	
	BufferMesh(mesh);
	
	var e = PhysicalEntity({}, mesh, true);
	e.shader = STD_SHADER;
	
	e.render = function(mtx)
	{
		mat4.set(Mat4List(e.matrix), mtx);
		DrawMesh(e.mesh, mtx, e.shader);
	}
	
	return e;
}

function addPoint(mesh, values, x, z, wrap, u, v)
{
	mesh.vertices = mesh.vertices.concat(values[x][z]);
	if (u === undefined || v === undefined) {
		mesh.uvs.push(x / (values.length));
		mesh.uvs.push(z / (values[0].length));
	} else {
		mesh.uvs.push(u / (values.length));
		mesh.uvs.push(v / (values[0].length));
	}
	
	var X = values.length;
	var Z = values[0].length;
	
	if (true)
	{
		var normal = Vector3();
		if (x > 0)
		{
			if (z > 0 || wrap)
				normal = VecAdd( normal,
							VecNormalize(VecCross(VecSub(values[x-1][z], values[x][z]), 
												  VecSub(values[x][(z-1+Z)%Z], values[x][z]))));
			if (z < values[0].length - 1 || wrap)
				normal = VecAdd( normal,
							VecNormalize(VecCross(VecSub(values[x][(z+1+Z)%Z], values[x][z]), 
												  VecSub(values[x-1][z], values[x][z]))));
		}
		if (x < values.length - 1)
		{
			if (z > 0 || wrap)
				normal = VecAdd( normal,
							VecNormalize(VecCross(VecSub(values[x][(z-1+Z)%Z], values[x][z]), 
												VecSub(values[x+1][z], values[x][z]))));
			if (z < values[0].length - 1 || wrap)
				normal = VecAdd( normal,
							VecNormalize(VecCross(VecSub(values[x+1][z], values[x][z]), 
												VecSub(values[x][(z+1)%Z], values[x][z]))));
		}
		if (wrap)
		{
			if (x==0)
				normal = VecCross(VecSub(values[x+1][z], values[x][z]),
								VecSub(values[x+1][(z+1)%Z], values[x][z]));
			else if (x==X-1)
				normal = VecCross(VecSub(values[x-1][z], values[x][z]),
								VecSub(values[x-1][(z+1)%Z], values[x][z]));
		}
			
		
		mesh.normals = mesh.normals.concat(VecNormalize(normal));
	}
	else
		mesh.normals = mesh.normals.concat(normals[x][z]);
}

function Math2Mesh(maths, xrange, zrange, quality)
{
	var values = [];
	var X, Z;
	var dx = (xrange[1] - xrange[0])/quality;
	var dz = (zrange[1] - zrange[0])/quality;
	var delta = dx < dz ? dx : dz;
	for (var x = xrange[0], X =0; x <= xrange[1]; x += delta, X++)
	{
		values.push([]);
		for (var z = zrange[0], Z = 0; z <= zrange[1]; z += delta, Z++)
		{
			values[X].push(Vector3(x,maths(x,z),z));
		}
	}
	
	//  1	  25
	//
	//	0 / 1
	//
	//  34	  6
	
	var mesh = {};
	mesh.count = (X - 1) * (Z - 1) * 2;
	mesh.vertices = [];
	mesh.normals = [];
	mesh.uvs = [];
	for (var x = 0; x < X-1; x++)
		for (var z = 0; z < Z-1; z++)
		{
			addPoint(mesh, values, x,   z);
			addPoint(mesh, values, x+1, z);
			addPoint(mesh, values, x,   z+1);
			addPoint(mesh, values, x,   z+1);
			addPoint(mesh, values, x+1, z);
			addPoint(mesh, values, x+1, z+1);
		}
	
	return mesh;
}


function Math2MeshSphere(maths, slices, cuts)
{
	var values = [];
	var normals = [];
	for (var slice = 0; slice <= slices; slice++)
	{
		values.push([]);
		normals.push([]);
		var theta = slice/slices*Math.PI;
		for (var cut = 0; cut < cuts; cut++)
		{
			var phi = cut/cuts*Math.PI*2 - Math.PI;
			var r = maths(phi, theta);
			normals[slice][cut] = Vector3(cos(phi)*sin(theta), cos(theta), sin(phi)*sin(theta));
			values[slice][cut] = VecScale(normals[slice][cut], r);
		}
	}
	
	var mesh = {};
	mesh.count = (slices - 1) * cuts * 2
	mesh.vertices = [];
	mesh.normals = [];
	mesh.uvs = [];
	for (var slice = 1; slice < slices-1; slice++)
		for (var cut = 0; cut < cuts; cut++)
		{
			addPoint(mesh, values, slice,   cut, normals);
			addPoint(mesh, values, slice+1, cut, normals);
			addPoint(mesh, values, slice,   (cut+1)%cuts, normals, slice, cut+1);
			addPoint(mesh, values, slice,   (cut+1)%cuts, normals, slice, cut+1);
			addPoint(mesh, values, slice+1, cut, normals);
			addPoint(mesh, values, slice+1, (cut+1)%cuts, normals, slice+1, cut+1);
		}
	for (var cut = 0; cut < cuts; cut++)
	{
		addPoint(mesh, values, 0, 0, normals, 0, cut+1);
		addPoint(mesh, values, 1, cut, normals);
		addPoint(mesh, values, 1, (cut+1)%cuts, normals, 1, cut+1);
		addPoint(mesh, values, slices-1, (cut+1)%cuts, normals, slices-1, cut+1);
		addPoint(mesh, values, slices-1, cut, normals);
		addPoint(mesh, values, slices, 0, normals, slices, cut+1);		
	}
	
	return mesh;
}


function Math2MeshCylinder(maths, slices, cuts, caps)
{
	var values = [];
	var normals = [];
	for (var slice = 0; slice < slices; slice++)
	{
		values.push([]);
		normals.push([]);
		for (var cut = 0; cut < cuts; cut++)
		{
			var phi = cut/cuts*Math.PI*2 - Math.PI;
			// takes an angle and t parameter [0,1] and returns a vertex
			var x = maths(slice/slices, phi);
			normals[slice][cut] = x;
			values[slice][cut] = x;
		}
	}
	
	
	var mesh = {};
	mesh.count = (slices - 1) * cuts * 2
	if (caps) mesh.count += cuts * 2;
	mesh.vertices = [];
	mesh.normals = [];
	mesh.uvs = [];
	for (var slice = 0; slice < slices - 1; slice++)
		for (var cut = 0; cut < cuts; cut++)
		{
			addPoint(mesh, values, slice,   cut, normals);
			addPoint(mesh, values, slice+1, cut, normals);
			addPoint(mesh, values, slice,   (cut+1)%cuts, normals, slice, cut+1);
			addPoint(mesh, values, slice,   (cut+1)%cuts, normals, slice, cut+1);
			addPoint(mesh, values, slice+1, cut, normals);
			addPoint(mesh, values, slice+1, (cut+1)%cuts, normals, slice+1, cut+1);
		}
	if (caps) {
		// add top and bottom caps
		// sort of doesnt work
		values.push([]);
		normals.push([]);
		values[slices][0] = values[0][0];
		values[slices][1] = VecScale(VecAdd(values[0][0], values[0][cuts/2]), 0.5);
		values[slices][2] = values[0][cuts/2];
		values[slices][3] = values[slices-1][0];
		values[slices][4] = VecScale(VecAdd(values[slices-1][0], values[slices-1][cuts/2]), 0.5);
		values[slices][5] = values[slices-1][cuts/2];
		for (var i = 0; i < 3; i++) normals[slices].push([0, -1, 0]);
		for (var i = 0; i < 3; i++) normals[slices].push([0, 1, 0]);
		
		for (var cut = 0; cut < cuts; cut++)
		{
			addPoint(mesh, values, slices, 1, normals, 0, cut+1);
			addPoint(mesh, values, 1, cut, normals);
			addPoint(mesh, values, 1, (cut+1)%cuts, normals, 1, cut+1);
			addPoint(mesh, values, slices-1, (cut+1)%cuts, normals, slices-1, cut+1);
			addPoint(mesh, values, slices-1, cut, normals);
			addPoint(mesh, values, slices, 4, normals, slices, cut+1);		
		}
	}
	
	return mesh;
}

//////////////////////////////////////////////////////
// PHYSICS
//////////////////////////////////////////////////////

// euler integration
function physics(p, dt)
{
	// movement
	p.pos[0] += p.vel[0] * dt;
	p.pos[1] += p.vel[1] * dt;
	p.pos[2] += p.vel[2] * dt;
	
	// acceleration
	if (p.accl)
	{
		p.vel[0] += p.accl[0] * dt;
		p.vel[1] += p.accl[1] * dt;
		p.vel[2] += p.accl[2] * dt;
	}
	
	// drag
	if (p.drag)
	{
		p.vel[0] -= p.vel[0] * p.drag * dt;
		p.vel[1] -= p.vel[1] * p.drag * dt;
		p.vel[2] -= p.vel[2] * p.drag * dt;
	}
	
	// rotation
	if (p.rotv !== undefined)
	{
		p.rot += p.rotv * dt;
	}
	
	if (p.rota !== undefined)
	{
		p.rotv += p.rota * dt;
	}
}


//////////////////////////////////////////////////////
// MISC ENTITIES
//////////////////////////////////////////////////////

function Camera(vector) {
	var cameraMtx = mat4.create();
	mat4.lookAt([0,0,0], vector, [0, 1, 0], cameraMtx);
	return {
		getMatrix: function ()
		{
			return cameraMtx;
		}
	};
}


// tracking camera
function TrackingCamera(target)
{
	var camera = {
		pos:	[0, 10, 0],
		vel:	[0, 0, 0],
		accl:	[0, 0, 0],
		drag:	3.0,
		bounds: {min: [-1, -1, -1], max: [1, 1, 1]}
	};

	var tpos = [0, 0, 1];
	var ctpos = [0, 0, 0]
	
	camera.update = function (dt)
	{
		// target tracking
		if (target && target.pos)
		{
			tpos[0] = target.pos[0];
			tpos[1] = target.pos[1] + 0.5;
			tpos[2] = target.pos[2];
			
			ctpos = VecRotate(Vector3(0.0, 2.0, -8.0), target.rot);
			ctpos = VecScale(ctpos, 0.12);
			ctpos = VecAdd(ctpos, tpos);
		}
		
		if (VecLengthSqr(VecSub(ctpos, camera.pos)) > 200*200)
			camera.pos = VecCopy(ctpos);
		
		// camera acceleration
		camera.accl[0] = (ctpos[0] - camera.pos[0]) * 25.0;
		camera.accl[1] = (ctpos[1] - camera.pos[1]) * 25.0;
		camera.accl[2] = (ctpos[2] - camera.pos[2]) * 25.0;
		
		physics(camera, dt);
		//collision(camera, bounds);
	};
	
	var cameraMtx = mat4.create();	
	camera.getMatrix = function ()
	{
		mat4.lookAt(camera.pos, tpos, [0.0, 1.0, 0.0], cameraMtx);
		return cameraMtx;
	};

	return camera;
}

// team duck
