let vPaintTool;
let depthToggle;
let hasvcprop;
let colorprop;
const degToRad = deg => deg * (Math.PI / 180);

Plugin.register('bbcolor', {
    title: 'Vertex Colors',
    author: 'Host',
    icon: 'color_lens',
    description: 'Simple vertex colors in Blockbench',
    version: '1.0.0',
    variant: 'both',
    onload() {
		hasvcprop = new Property(Mesh, 'boolean', 'has_vc', {
    		default: false
		})
		colorprop = new Property(MeshFace, 'array', 'colors', {
    		default: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]]
		})
		Outliner.buttons.has_vc = {
			advanced_option: true,
			icon: 'color_lens',
			icon_off: 'color_lens',
			id: 'has_vc',
			title: 'Enable Vertex Colors',
			condition: {modes: 'edit'},
			getState(element) {
				return element.has_vc;
			},
			visibilityException(node) {
				return node.has_vc;
			}
		}
		Mesh.prototype.buttons.splice(0, 0, Outliner.buttons.has_vc);
		depthToggle  = new Toggle('vpaint_depth', {
			name: 'Disable Depth Check',
			description: 'Allows affecting faces that aren\'t visible',
			icon: 'disabled_visible',
			category: 'edit',
			condition: () => Toolbox?.selected?.id === 'vertex_paint',
		})
		let alphaToggle  = new Toggle('vpaint_alpha', {
			name: 'Affect Alpha',
			description: 'Allows affecting the alpha channel of the color',
			icon: 'gradient',
			category: 'edit',
			condition: () => Toolbox?.selected?.id === 'vertex_paint',
		})
		let selectToggle  = new Toggle('vpaint_sel', {
			name: 'Select Mode',
			description: 'Allows you to select faces while using the vertex paint tool.',
			icon: 'highlight_alt',
			category: 'edit',
			condition: () => Toolbox?.selected?.id === 'vertex_paint',
		})
		console.log(selectToggle);
		selectToggle.on('change', (data) => {
			vPaintTool.selectElements = data.state;
		})
        let brush_outline;
        let size_slider = new NumSlider('slider_vertex_paint_size', {
	        condition: () => Toolbox?.selected?.id === 'vertex_paint',
	        tool_setting: 'vpaint_size',
	        category: 'edit',
			name: 'Radius',
			desc: 'The radius in which vertex painting occurs',
	        settings: {
		        min: 1, max: 1024, interval: 1, default: 50,
	        }
        })
		let alpha_slider = new NumSlider('slider_vpaint_alpha', {
	        condition: () => Toolbox?.selected?.id === 'vertex_paint',
	        tool_setting: 'vpaint_alpha',
	        category: 'edit',
			name: 'Alpha',
			desc: 'The alpha value to paint on',
	        settings: {
		        min: 0, max: 100, interval: 1, default: 100,
	        }
        })
		alpha_slider.on('change', (data) => {
			vPaintTool.alpha = data.number / 100.0;
		})
		Panels.color.condition.modes.push('edit');
		Panels.palette.condition.modes.push('edit');
		let screen_space_vertex_positions = null;
		const raycaster = new THREE.Raycaster();
		function updateScreenSpaceVertexPositions2(mesh) {
			if (screen_space_vertex_positions) return screen_space_vertex_positions;

			const depth_check = (BarItems.vpaint_depth).value == false;
			let vec = new THREE.Vector3();
			raycaster.ray.origin.setFromMatrixPosition(Preview.selected.camera.matrixWorld);
			let raycasts = 0;

			screen_space_vertex_positions = {};
			
			for (let vkey in mesh.vertices) {
				let pos = mesh.mesh.localToWorld(vec.fromArray(mesh.vertices[vkey]));

				if (depth_check) {
					raycaster.ray.direction.copy(pos).sub(raycaster.ray.origin)
					const z_distance = raycaster.ray.direction.length();
					raycaster.ray.direction.normalize();
					let intersection = raycaster.intersectObject(mesh.mesh, false)[0];
					raycasts++;
					if (intersection && intersection.distance < z_distance-0.001) {
						continue;
					}
				}
				let screen_pos = Preview.selected.vectorToScreenPosition(pos.clone());
				screen_space_vertex_positions[vkey] = screen_pos;
			}
			return screen_space_vertex_positions;
		}
		Blockbench.on('update_camera_position', () => {
			screen_space_vertex_positions = null;
		})

		function cvtHexToFloat(hex) {
			let noHash = hex.replace(/^#/, '');
			const red = parseInt(noHash.substring(0,2), 16);
			const green = parseInt(noHash.substring(2,4), 16);
			const blue = parseInt(noHash.substring(4,6), 16);
			return [red / 255, green / 255, blue / 255];
		}
		let fill_faces = new Action('fillfaces', {
			category: 'edit',
			name: 'Fill Faces',
			description: 'Fills the selected faces with a vertex color',
			icon: 'format_color_fill',
			default_shortcut: {
				label: 'Fill Faces',
				ctrl: true,
				key: 186
			},
			click: function() {
				Undo.initEdit({elements: Mesh.selected, mirror_modeling: false});
				for (let j = 0; j < Mesh.selected.length; j++) {
					let mesh = Mesh.selected[j];
					for (const face of Object.values(mesh.faces)) {
						if (!face.isSelected()) continue;
						for (let i = 0; i < 4; i++) {
							face.colors[i] = [
								...cvtHexToFloat(Panels.color.vue.main_color),
								alphaToggle.value
									? alpha_slider.value / 100
									: face.colors[i][3]
							];
						}
					}
					Mesh.preview_controller.updateGeometry(mesh);
				}
				Undo.finishEdit('Fill faces');
			} 
		})
		function getQuickShadeColor(color1, color2, normal) {

			const factor =
				(1 - normal[1]) / 2
				+ (Math.abs(normal[0]) - Math.abs(normal[2])) / 6;

			return [
				color1[0] + (color2[0] - color1[0]) * factor,
				color1[1] + (color2[1] - color1[1]) * factor,
				color1[2] + (color2[2] - color1[2]) * factor,
				color1[3] + (color2[3] - color1[3]) * factor
			];
		}
		function eulerToAxisAngle(euler) {
			let qaut = new THREE.Quaternion();
			qaut.setFromEuler(euler);
			let axis = new THREE.Vector3();
			let angle = 0;
			angle = 2 * Math.acos(qaut.w);
			if (angle > 0) {
				const s = Math.sqrt(1 - qaut.w * qaut.w);
				axis.x = qaut.x / s;
				axis.y = qaut.y / s;
				axis.z = qaut.z / s;
			} else {
				axis.set(1, 0, 0);
			}
			return [axis, angle];
		}
		let qSS = {
			color1: '#ffffff',
			color2: '#7f7f7f',
			rotX: 0,
			rotY: 0,
			rotZ: 0
		}
		let quickShadeAction = new Action('quick_shade', {
			name: 'Quick Shade',
			icon: 'highlight',
			click() {
				new Dialog('quick_shade_dialog', {
					title: 'Quick Shade',
					width: 400,

					form: {
						color1: {
							label: 'Color 1',
							type: 'color',
							value: qSS.color1
						},
						color2: {
							label: 'Color 2',
							type: 'color',
							value: qSS.color2
						},
						rotX: {
							label: 'X Rotation',
							type: 'number',
							value: qSS.rotX,
							min: 0,
							max: 360
						},
						rotY: {
							label: 'Y Rotation',
							type: 'number',
							value: qSS.rotY,
							min: 0,
							max: 360
						},
						rotZ: {
							label: 'Z Rotation',
							type: 'number',
							value: qSS.rotZ,
							min: 0,
							max: 360
						},
					},
					onConfirm(form) {
						qSS = {
							color1: form.color1.toHex8String(),
							color2: form.color2.toHex8String(),
							rotX: form.rotX,
							rotY: form.rotY,
							rotZ: form.rotZ
						};
						Undo.initEdit({elements: Mesh.selected, mirror_modeling: false});
						let c1 = [form.color1._r / 255, form.color1._g / 255, form.color1._b / 255, form.color1._a];
						let c2 = [form.color2._r / 255, form.color2._g / 255, form.color2._b / 255, form.color2._a];
						let radTation = new THREE.Euler(degToRad(form.rotX),degToRad(form.rotY),degToRad(form.rotZ), 'XYZ')
						for (let j = 0; j < Mesh.selected.length; j++) {
							let mesh = Mesh.selected[j];
							for (const face of Object.values(mesh.faces)) {
								if (!face.isSelected()) continue;
								for (let i = 0; i < face.vertices.length; i++) {
									let normal;
									if (mesh.shading === 'smooth') {
										normal = getVertexNormal(mesh, face.vertices[i]);
									} else {
										normal = new THREE.Vector3()
											.fromArray(face.getNormal(true));
									}
									const worldNormal = normal
										.transformDirection(mesh.mesh.matrixWorld)
										.normalize()
										.toArray();
									let interpolatedColor = getQuickShadeColor(c1, c2, worldNormal);
									face.colors[i] = [
										...interpolatedColor.splice(0,3),
										alphaToggle.value
											? interpolatedColor[3]
											: face.colors[i][3]
									];
								}
							}
							Mesh.preview_controller.updateGeometry(mesh);
						}
						Undo.finishEdit('Quick shade');
					}
				}).show();
			}
		});
		function rayIntersectsTriangle(origin, direction, a, b, c) {
			const EPSILON = 0.000001;

			const edge1 = new THREE.Vector3().subVectors(b, a);
			const edge2 = new THREE.Vector3().subVectors(c, a);

			const h = new THREE.Vector3().crossVectors(direction, edge2);
			const det = edge1.dot(h);

			if (Math.abs(det) < EPSILON) {
				return null;
			}

			const invDet = 1 / det;

			const s = new THREE.Vector3().subVectors(origin, a);
			const u = s.dot(h) * invDet;

			if (u < 0 || u > 1) {
				return null;
			}

			const q = new THREE.Vector3().crossVectors(s, edge1);
			const v = direction.dot(q) * invDet;

			if (v < 0 || u + v > 1) {
				return null;
			}

			const t = edge2.dot(q) * invDet;

			if (t > EPSILON) {
				return t;
			}

			return null;
		};
		function getFaceTriangles(face) {
			const v = face.vertices;

			if (v.length === 3) {
				return [
					[v[0], v[1], v[2]]
				];
			}

			if (v.length === 4) {
				return [
					[v[0], v[1], v[2]],
					[v[0], v[2], v[3]]
				];
			}

			return [];
		};
		function getWorldVertex(mesh, vkey) {
			const position = mesh.vertices[vkey];

			return new THREE.Vector3(
				position[0],
				position[1],
				position[2]
			).applyMatrix4(mesh.mesh.matrixWorld);
		};
		function raycastTowardLight(
			origin,
			direction,
			originMesh,
			originFace
		) {
			let closestDistance = Infinity;
			let closestFace = null;

			for (const mesh of Mesh.all) {
				if (!mesh.visibility) continue;

				for (const face of Object.values(mesh.faces)) {
					if (mesh === originMesh && face === originFace) {
						continue;
					}

					const normal = new THREE.Vector3()
						.fromArray(face.getNormal(true))
						.transformDirection(mesh.mesh.matrixWorld)
						.normalize();

					if (normal.dot(direction) >= 0) {
						continue;
					}

					const triangles = getFaceTriangles(face);

					for (const triangle of triangles) {
						const a = getWorldVertex(mesh, triangle[0]);
						const b = getWorldVertex(mesh, triangle[1]);
						const c = getWorldVertex(mesh, triangle[2]);

						const distance = rayIntersectsTriangle(
							origin,
							direction,
							a,
							b,
							c
						);

						if (
							distance !== null &&
							distance < closestDistance
						) {
							closestDistance = distance;
							closestFace = face;
						}
					}
				}
			}

			return closestFace;
		};
		function isVertexShadowed(
			vertexPosition,
			toLight,
			originMesh,
			originFace
		) {
			const EPSILON = 0.001;

			const rayOrigin = vertexPosition.clone()
				.addScaledVector(toLight, EPSILON);

			const hitFace = raycastTowardLight(
				rayOrigin,
				toLight,
				originMesh,
				originFace
			);

			return hitFace !== null;
		};
		function lerpColor(a, b, t) {
			return [
				a[0] + (b[0] - a[0]) * t,
				a[1] + (b[1] - a[1]) * t,
				a[2] + (b[2] - a[2]) * t,
				a[3] + (b[3] - a[3]) * t
			];
		}
		function getVertexNormal(mesh, vkey) {
			const normal = new THREE.Vector3();

			for (const otherFace of Object.values(mesh.faces)) {
				if (!otherFace.vertices.includes(vkey)) continue;

				const faceNormal = new THREE.Vector3()
					.fromArray(otherFace.getNormal(true));

				normal.add(faceNormal);
			}

			return normal.normalize();
		}
		let lbSS = {
			lightcolor: '#ffffff',
			shadecolor: '#7f7f7f',
			shadowtint: '#bfbfbf',
			rotX: 0,
			rotY: 0,
			rotZ: 0,
			smooth: false
		}
		let lightShadeAction = new Action('lightshade', {
			name: 'Light-Based Shade',
			icon: 'wb_sunny',
			click() {
				new Dialog('light_shade_dialog', {
					title: 'Light-Based Shade',
					width: 400,

					form: {
						lightcolor: {
							label: 'Light Color',
							type: 'color',
							value: lbSS.lightcolor
						},
						shadecolor: {
							label: 'Shade Color',
							type: 'color',
							value: lbSS.shadecolor
						},
						shadowtint: {
							label: 'Shadow Tint',
							type: 'color',
							value: lbSS.shadowtint
						},
						rotX: {
							label: 'X Rotation',
							type: 'number',
							value: lbSS.rotX,
							min: 0,
							max: 360
						},
						rotY: {
							label: 'Y Rotation',
							type: 'number',
							value: lbSS.rotY,
							min: 0,
							max: 360
						},
						rotZ: {
							label: 'Z Rotation',
							type: 'number',
							value: lbSS.rotZ,
							min: 0,
							max: 360
						},
						smooth: {
							label: 'Smooth Shadows',
							type: 'checkbox',
							value: lbSS.smooth
						}
					},
					onConfirm(form) {
						lbSS = {
							lightcolor: form.lightcolor.toHex8String(),
							shadecolor: form.shadecolor.toHex8String(),
							shadowtint: form.shadowtint.toHex8String(),
							rotX: form.rotX,
							rotY: form.rotY,
							rotZ: form.rotZ,
							smooth: form.smooth
						};
						Undo.initEdit({elements: Mesh.selected, mirror_modeling: false});
						let lc = [form.lightcolor._r / 255, form.lightcolor._g / 255, form.lightcolor._b / 255, form.lightcolor._a];
						let sc = [form.shadecolor._r / 255, form.shadecolor._g / 255, form.shadecolor._b / 255, form.shadecolor._a];
						let st = [form.shadowtint._r / 255, form.shadowtint._g / 255, form.shadowtint._b / 255, form.shadowtint._a];
						let radTation = new THREE.Euler(degToRad(form.rotX),degToRad(form.rotY),degToRad(form.rotZ), 'XYZ');
						const lightDirection = new THREE.Vector3(0, 1, 0)
    									.applyEuler(radTation)
    									.normalize();
						for (let j = 0; j < Mesh.selected.length; j++) {
							let mesh = Mesh.selected[j];
							for (const face of Object.values(mesh.faces)) {
								let shadowed;
								if (!face.isSelected()) continue;
								if (!form.smooth) {
									shadowed = isVertexShadowed(new THREE.Vector3().fromArray(face.getCenter()).applyMatrix4(mesh.mesh.matrixWorld), lightDirection, mesh, face);
								};
								for (let i = 0; i < face.vertices.length; i++) {
									if (form.smooth) {
										shadowed = isVertexShadowed(new THREE.Vector3().fromArray(face.mesh.vertices[face.vertices[i]]).applyMatrix4(mesh.mesh.matrixWorld), lightDirection, mesh, face);
									};
									let normal;

									if (mesh.shading === 'smooth') {
										normal = getVertexNormal(mesh, face.vertices[i]);
									} else {
										normal = new THREE.Vector3()
											.fromArray(face.getNormal(true));
									}

									const worldNormal = normal
										.transformDirection(mesh.mesh.matrixWorld)
										.normalize();
									const facing = worldNormal.dot(lightDirection);
									const COS_225 = Math.cos(Math.PI / 8);

									let t;

									if (facing >= COS_225) {
										t = 0;
									} else {
										t = (COS_225 - facing) / (COS_225 + 1);
									}
									let color = lerpColor(lc, sc, t);
									const result = color.map((num, index) => num * (shadowed ? st[index] : 1));
									face.colors[i] = [
										...result.slice(0,3),
										alphaToggle.value
											? result[3]
											: face.colors[i][3]
									];
								}
							}
							Mesh.preview_controller.updateGeometry(mesh);
						}
						Undo.finishEdit('Light-based shade');
					}
				}).show();
			}
		});
        vPaintTool = new Tool('vertex_paint', {
            name: 'Vertex Paint',
            icon: 'color_lens',
            category: 'tools',
	        cursor: 'crosshair',
	        transformerMode: 'hidden',
	        selectElements: false,
	        modes: ['edit'],
	        condition: {modes: ['edit'], selected: {mesh: true}},
			toolbar: 'vertex_paint',
			preselection: '',
			alpha: 1,
            onSelect() {
                Canvas.updateView({elements: [...Mesh.all], element_aspects: {faces: true}});
				size_slider.update();
				alpha_slider.update();
                brush_outline = brush_outline ?? Interface.createElement('div', {id: 'weight_brush_outline'});
		        document.addEventListener('pointermove', updateBrushOutline);
				this.preselection = BarItems.selection_mode.value;
				BarItems.selection_mode.change('face');
            },
			onUnselect() {
				setTimeout(() => {
					Canvas.updateView({elements: [...Mesh.all], element_aspects: {faces: true}});
				}, 0);
				if (brush_outline) brush_outline.remove()
				document.removeEventListener('pointermove', updateBrushOutline);
				BarItems.selection_mode.change(this.preselection);
			},
			onCanvasClick(data) {
				if (!selectToggle.value) {
					const mesh =
					data.element &&
					data.element.type === 'mesh' &&
					data.element.selected
						? data.element
						: null;

					const isValid =
						mesh &&
						data.event instanceof PointerEvent;

					if (isValid) {
						const v = Preview.selected.controls.enableRotate;
						Preview.selected.controls.enableRotate = false;
						Undo.initEdit({elements: Mesh.selected, mirror_modeling: false});
						setTimeout(() => {
							Preview.selected.controls.enableRotate = v;
						}, 50);
					}

					const draw = (event) => {
						if (!isValid) return;
						updateScreenSpaceVertexPositions2(mesh);
						let preview = Preview.selected;
						let preview_offset = $(preview.canvas).offset();
						const radius = size_slider.value;
						const radius_sq = radius * radius;
						for (const face of Object.values(mesh.faces)) {
							if (!face.isSelected()) continue;
							const vertices = face.vertices;
							for (let i = 0; i < vertices.length; i++) {
								const vKey = vertices[i];
								const scrPos = screen_space_vertex_positions[vKey];
								if (!scrPos) continue;
								const dx = scrPos.x - (event.clientX - preview_offset.left);
								const dy = scrPos.y - (event.clientY - preview_offset.top);

								if (dx*dx + dy*dy <= radius_sq) {
									face.colors[i] = [
										...cvtHexToFloat(Panels.color.vue.main_color),
										alphaToggle.value
											? alpha_slider.value / 100
											: face.colors[i][3]
									];

								}
							}
						}
						Mesh.preview_controller.updateGeometry(mesh);
					};
					const stop = (event) => {
						document.removeEventListener('pointermove', draw);
						document.removeEventListener('pointerup', stop);

						Undo.finishEdit('Paint vertex colors');
					}
					document.addEventListener('pointermove', draw);
					document.addEventListener('pointerup', stop);
					draw(data.event, data);
				}
			}	
    	})
		vPaintTool.alpha = 1;
        function updateBrushOutline(event) {
        	if (!brush_outline || Toolbox.selected.id != 'vertex_paint') return;
        	let preview = Preview.selected;
        	preview.node.append(brush_outline);
        	brush_outline.style.display = (event.altKey || Pressing.overrides.alt) ? 'none' : 'block'

        	if ('clientX' in event) {
        		let preview_offset = $(preview.canvas).offset();
        		let click_pos = [
        			event.clientX - preview_offset.left,
        			event.clientY - preview_offset.top,
        		]
        		brush_outline.style.left = click_pos[0] + 'px';
        		brush_outline.style.top = click_pos[1] + 'px';
        	}
        }
		document.addEventListener('touchend', () => {
			if (brush_outline && brush_outline.isConnected) {
				brush_outline.remove();
			}
		})
        size_slider.on('change', (data) => {
	        if (brush_outline) {
		        brush_outline.style.setProperty('--radius', data.number.toString());
	        }
        })
		Toolbars.vertex_paint = new Toolbar({
			id: 'vertex_paint',
			no_wrap: true,
			children: [
				'slider_vertex_paint_size',
				'vpaint_depth',
				'vpaint_alpha',
				'slider_vpaint_alpha',
				'vpaint_sel',
				'fillfaces',
				'quick_shade',
				'lightshade'
			]
		})
		MenuBar.menus.tools.addAction('vertex_paint');
		Toolbox.add('vertex_paint');
		const OriginalShaderMaterial = THREE.ShaderMaterial;

        THREE.ShaderMaterial = function(parameters) {
            if (parameters && isBlockbenchTextureShader(parameters)) {
                modparameters = {
                    ...parameters,

                    vertexShader: modifyVertexShader(parameters.vertexShader),
                    fragmentShader: modifyFragmentShader(parameters.fragmentShader)
                };
            }

            return new OriginalShaderMaterial(modparameters);
        };

        THREE.ShaderMaterial.prototype = OriginalShaderMaterial.prototype;
        THREE.ShaderMaterial.prototype.constructor = THREE.ShaderMaterial;

        function isBlockbenchTextureShader(parameters) {
            return (
                typeof parameters.vertexShader === 'string' &&
                typeof parameters.fragmentShader === 'string' &&
                parameters.vertexShader.includes('uniform bool SHADE;') &&
                parameters.vertexShader.includes('uniform int LIGHTSIDE;') &&
                parameters.fragmentShader.includes('uniform bool EMISSIVE;') &&
                parameters.fragmentShader.includes('uniform sampler2D map;')
            );
        }

        function modifyVertexShader(shader) {
            return shader.replace(
				'float ZFAC=0.05;void main(){',
				'float ZFAC=0.05;attribute vec4 vColor;varying vec4 vertexColor;attribute float enableVC;varying float hasVC;void main(){vertexColor=vColor;hasVC=enableVC;'
			);
        }

        function modifyFragmentShader(shader) {
			modified = shader.replace(
				'vec4 color=texture2D(map,vUv);',
				`
				vec4 color = texture2D(map,vUv);
				if (hasVC > 0.5) {
					color *= vertexColor;
				}
				`
			).replace(
				'varying float lift;',
				'varying float lift;varying vec4 vertexColor;varying float hasVC;'
			).replace(
				'if(EMISSIVE==false){',
				'if(hasVC>0.5){vec4 lit_color = vec4(lift + color.rgb, color.a);gl_FragColor = lit_color;}else if(EMISSIVE==false){'
			);
            return modified;
        }
		const oldUpdateGeometry =
			Mesh.preview_controller.updateGeometry;

		Mesh.preview_controller.updateGeometry = function(element, vertexoffsets) {
			oldUpdateGeometry.call(this, element, vertexoffsets);
			
			const geometry = element.mesh.geometry;
			const vcolor_array = [];
			const hasvc_array = [];

			for (const key in element.faces) {
				const face = element.faces[key];
				
				if (face.vertices.length <= 2) continue;

				face.vertices.forEach((vkey, i) => {

					const color = face.colors[i] ?? [1, 1, 1, 1] /* fallback if for some reason there are no colors*/;
					if (element.has_vc) {
						vcolor_array.push(
							color[0],
							color[1],
							color[2],
							color[3]
						);
					} else {
						vcolor_array.push(
							1,
							1,
							1,
							1
						);
					}
					hasvc_array.push(element.has_vc);
				});
			}

			geometry.setAttribute(
				'vColor',
				new THREE.Float32BufferAttribute(vcolor_array, 4)
			);
			geometry.setAttribute(
				'enableVC',
				new THREE.Float32BufferAttribute(hasvc_array, 1)
			)

			geometry.attributes.vColor.needsUpdate = true;
			geometry.attributes.enableVC.needsUpdate = true;
		};
		this.fbxCompileListener = function(data) {

			const model = data.model;

			const used_object_names = new Set();
			const mesh_by_geometry_name = new Map();

			function getUniqueObjectName(original_name) {
				if (!used_object_names.has(original_name)) {
					used_object_names.add(original_name);
					return original_name;
				}

				let i = 1;
				let name;

				do {
					name = original_name + '_' + i;
					i++;
				} while (used_object_names.has(name));

				used_object_names.add(name);
				return name;
			}

			for (const group of Group.all) {
				if (!group.export) continue;

				getUniqueObjectName(group.name);
			}

			for (const object of [...Locator.all, ...NullObject.all]) {
				if (!object.export) continue;

				getUniqueObjectName(object.name);
			}

			for (const mesh of Mesh.all) {
				if (!mesh.export) continue;

				const unique_name = getUniqueObjectName(mesh.name);

				if (mesh.has_vc) {
					mesh_by_geometry_name.set(
						'Geometry::' + unique_name,
						mesh
					);
				}
			}

			for (const section of model) {

				if (!section || typeof section !== 'object') continue;
				if (!section.Objects) continue;

				const objects = section.Objects;

				for (const key in objects) {

					const geometry = objects[key];

					if (!geometry) continue;

					if (geometry._key !== 'Geometry') continue;

					const geometry_name = geometry._values?.[1];

					if (!geometry_name) continue;

					const mesh = mesh_by_geometry_name.get(geometry_name);

					if (!mesh) continue;

					const vertex_colors = [];

					for (const face_key in mesh.faces) {

						const face = mesh.faces[face_key];

						if (face.vertices.length < 3) continue;

						const sorted_vertices = face.getSortedVertices();

						for (const vkey of sorted_vertices) {

							const original_index =
								face.vertices.indexOf(vkey);

							const color =
								face.colors?.[original_index] ||
								[1, 1, 1, 1];

							vertex_colors.push(
								color[0],
								color[1],
								color[2],
								color[3]
							);
						}
					}

					geometry.LayerElementColor = {
						_values: [0],
						Version: 101,
						Name: "VertexColors",
						MappingInformationType: "ByPolygonVertex",
						ReferenceInformationType: "Direct",

						Colors: {
							_values: [`_*${vertex_colors.length}`],
							_type: 'd',
							a: vertex_colors
						}
					};

					geometry.Layer.LayerElement4 = {
						_key: 'LayerElement',
						Type: "LayerElementColor",
						TypedIndex: 0
					};
					geometry.LayerElementUV = {
						_values: [0],
						Version: 101,
						Name: "",
						MappingInformationType: "ByPolygonVertex",
						ReferenceInformationType: "Direct",
						UV: {
							_values: [`_*${uv.length}`],
							_type: 'd',
							a: uv
						}
					};
					geometry.LayerElementTexture = {
						_values: [0],
						Version: 101,
						Name: "",
						MappingInformationType: "ByPolygon",
						ReferenceInformationType: "IndexToDirect",
						BlendMode: "Translucent",
						TextureAlpha: 1,
						TextureId: {
							_values: [`_*${textures.length}`],
							_type: 'i',
							a: textures.map(t => used_textures.indexOf(t))
						}
					};
					geometry.Layer.LayerElement4 = {
						_key: 'LayerElement',
						Type: "LayerElementTexture",
						TypedIndex: 0
					};
				}
			}

			for (const section of model) {

				if (!section || typeof section !== 'object') continue;
				if (!section.Objects) continue;

				for (const key in section.Objects) {

					const object = section.Objects[key];

					if (!object || typeof object !== 'object') continue;

					if (
						object._key === 'Video' &&
						object._values?.[1]?.startsWith('Video::')
					) {

						if (
							object.Filename === '' &&
							object.RelativeFilename === '' &&
							typeof object.Content === 'string'
						) {

							const video_name =
								object._values[1].substring('Video::'.length);

							const filename =
								/\.png$/i.test(video_name)
									? video_name
									: video_name + '.png';

							object.Filename = filename;
							object.RelativeFilename = filename;

							if (
								object.Properties70 &&
								object.Properties70.P &&
								object.Properties70.P[0] === 'Path'
							) {
								object.Properties70.P[4] = filename;
							}
						}
					}

					if (
						object._key === 'Texture' &&
						object._values?.[1]?.startsWith('Texture::')
					) {

						if (
							object.FileName === '' &&
							object.RelativeFilename === ''
						) {

							const texture_name =
								object._values[1].substring('Texture::'.length);

							const filename =
								/\.png$/i.test(texture_name)
									? texture_name
									: texture_name + '.png';

							object.FileName = filename;
							object.RelativeFilename = filename;
						}
					}
				}
			}
		};

		Codecs.fbx.on('compile', this.fbxCompileListener);
    },
	onunload() {
		// code is a little unfinished here, expect errors when reloading this plugin
		// sorry :/
		hasvcprop.delete();
		colorprop.delete();
	}
});
